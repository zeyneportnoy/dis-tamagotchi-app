import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getDatabase } from '@/data/db';
import { addCalendarMonths, dateOnlyFromDate, dateOnlyToDate } from '@/domain/family';
import i18n from '@/i18n';

type ReminderDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

type DentistVisitRow = {
  last_visit_date: string | null;
  routine_notification_id: string | null;
  next_appointment_date: string | null;
  appointment_notification_id: string | null;
};

export type DentistVisitState = Readonly<{
  /** Parent-entered last dentist visit ('YYYY-MM-DD'), or null. */
  lastVisitDate: string | null;
  /** Derived: exactly 6 calendar months after the last visit. */
  routineDueDate: string | null;
  routineScheduled: boolean;
  /** Parent-entered next appointment ('YYYY-MM-DD'), or null. */
  nextAppointmentDate: string | null;
  /** Derived: one calendar day before the appointment. */
  appointmentReminderDate: string | null;
  appointmentScheduled: boolean;
}>;

export type DentistVisitChild = Readonly<{ id: string; nickname: string }>;

type DentistVisitGateway = {
  getPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  cancel(id: string): Promise<void>;
  scheduleRoutine(input: {
    childProfileId: string;
    nickname: string;
    fireAt: Date;
  }): Promise<string>;
  scheduleAppointment(input: {
    childProfileId: string;
    nickname: string;
    fireAt: Date;
  }): Promise<string>;
};

const REMINDER_HOUR = 9;

/** Exactly `months` calendar months after a 'YYYY-MM-DD' date (day clamped). */
export function nextRoutineCheckDate(lastVisitDate: string, months = 6): string {
  const base = dateOnlyToDate(lastVisitDate);
  if (!base) return lastVisitDate;
  const day = base.getDate();
  const target = new Date(base.getFullYear(), base.getMonth(), 1, 12);
  target.setMonth(target.getMonth() + months);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfTargetMonth));
  return dateOnlyFromDate(target);
}

/** One calendar day before a 'YYYY-MM-DD' date. */
export function appointmentReminderDateFor(appointmentDate: string): string {
  const base = dateOnlyToDate(appointmentDate);
  if (!base) return appointmentDate;
  return dateOnlyFromDate(
    new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 12),
  );
}

/** A `Date` at 09:00 in the device's local timezone on the given calendar day. */
const atReminderHourLocal = (dateOnly: string): Date => {
  const base = dateOnlyToDate(dateOnly) ?? new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), REMINDER_HOUR, 0, 0, 0);
};

export class DentistVisitService {
  constructor(
    private readonly database: () => Promise<ReminderDatabase> = getDatabase,
    private readonly notifications: DentistVisitGateway = expoDentistVisitGateway,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async get(childProfileId: string): Promise<DentistVisitState> {
    const database = await this.database();
    const row = await database.getFirstAsync<DentistVisitRow>(
      `SELECT last_visit_date, routine_notification_id,
              next_appointment_date, appointment_notification_id
       FROM dentist_reminders WHERE child_profile_id = ?`,
      childProfileId,
    );
    const lastVisitDate = row?.last_visit_date ?? null;
    const nextAppointmentDate = row?.next_appointment_date ?? null;
    return {
      appointmentReminderDate: nextAppointmentDate
        ? appointmentReminderDateFor(nextAppointmentDate)
        : null,
      appointmentScheduled: Boolean(row?.appointment_notification_id),
      lastVisitDate,
      nextAppointmentDate,
      routineDueDate: lastVisitDate ? nextRoutineCheckDate(lastVisitDate) : null,
      routineScheduled: Boolean(row?.routine_notification_id),
    };
  }

  /**
   * Save this child's last dentist visit, cancel any previous 6-month routine
   * reminder, and schedule exactly one new one for 6 calendar months later at
   * 09:00 local. The date is always saved even when notifications are off or the
   * computed reminder is already in the past.
   */
  async setLastVisitDate(
    child: DentistVisitChild,
    lastVisitDate: string,
  ): Promise<{ permissionDenied: boolean }> {
    const database = await this.database();
    await this.ensureRow(database, child.id);

    const existing = await database.getFirstAsync<Pick<DentistVisitRow, 'routine_notification_id'>>(
      `SELECT routine_notification_id FROM dentist_reminders WHERE child_profile_id = ?`,
      child.id,
    );
    if (existing?.routine_notification_id) {
      await this.notifications.cancel(existing.routine_notification_id).catch(() => undefined);
    }
    await database.runAsync(
      `UPDATE dentist_reminders
       SET last_visit_date = ?, routine_notification_id = NULL, updated_at = ?
       WHERE child_profile_id = ?`,
      lastVisitDate,
      this.now(),
      child.id,
    );

    const fireAt = atReminderHourLocal(nextRoutineCheckDate(lastVisitDate));
    let permissionDenied = false;
    try {
      if ((await this.notifications.getPermission()) !== 'granted') {
        permissionDenied = true;
      } else if (fireAt.getTime() > Date.now()) {
        const notificationId = await this.notifications.scheduleRoutine({
          childProfileId: child.id,
          fireAt,
          nickname: child.nickname,
        });
        await database.runAsync(
          `UPDATE dentist_reminders SET routine_notification_id = ?, updated_at = ?
           WHERE child_profile_id = ?`,
          notificationId,
          this.now(),
          child.id,
        );
      }
    } catch {
      // Best-effort: the last-visit date is already persisted.
    }
    return { permissionDenied };
  }

  /**
   * Save this child's next appointment, cancel any previous appointment
   * reminder, and schedule exactly one new one for the calendar day before, at
   * 09:00 local. Does not touch the 6-month routine reminder.
   */
  async setNextAppointmentDate(
    child: DentistVisitChild,
    appointmentDate: string,
  ): Promise<{ permissionDenied: boolean }> {
    const database = await this.database();
    await this.ensureRow(database, child.id);

    const existing = await database.getFirstAsync<
      Pick<DentistVisitRow, 'appointment_notification_id'>
    >(
      `SELECT appointment_notification_id FROM dentist_reminders WHERE child_profile_id = ?`,
      child.id,
    );
    if (existing?.appointment_notification_id) {
      await this.notifications.cancel(existing.appointment_notification_id).catch(() => undefined);
    }
    await database.runAsync(
      `UPDATE dentist_reminders
       SET next_appointment_date = ?, appointment_notification_id = NULL, updated_at = ?
       WHERE child_profile_id = ?`,
      appointmentDate,
      this.now(),
      child.id,
    );

    const fireAt = atReminderHourLocal(appointmentReminderDateFor(appointmentDate));
    let permissionDenied = false;
    try {
      if ((await this.notifications.getPermission()) !== 'granted') {
        permissionDenied = true;
      } else if (fireAt.getTime() > Date.now()) {
        const notificationId = await this.notifications.scheduleAppointment({
          childProfileId: child.id,
          fireAt,
          nickname: child.nickname,
        });
        await database.runAsync(
          `UPDATE dentist_reminders SET appointment_notification_id = ?, updated_at = ?
           WHERE child_profile_id = ?`,
          notificationId,
          this.now(),
          child.id,
        );
      }
    } catch {
      // Best-effort: the appointment date is already persisted.
    }
    return { permissionDenied };
  }

  /** Clear the next appointment and cancel ONLY its reminder. */
  async clearNextAppointment(childProfileId: string): Promise<void> {
    const database = await this.database();
    const row = await database.getFirstAsync<
      Pick<DentistVisitRow, 'appointment_notification_id'>
    >(
      `SELECT appointment_notification_id FROM dentist_reminders WHERE child_profile_id = ?`,
      childProfileId,
    );
    if (row?.appointment_notification_id) {
      await this.notifications.cancel(row.appointment_notification_id).catch(() => undefined);
    }
    await database.runAsync(
      `UPDATE dentist_reminders
       SET next_appointment_date = NULL, appointment_notification_id = NULL, updated_at = ?
       WHERE child_profile_id = ?`,
      this.now(),
      childProfileId,
    );
  }

  /** A child recovered from the cloud may not have a dentist_reminders row yet. */
  private async ensureRow(database: ReminderDatabase, childProfileId: string): Promise<void> {
    const nowIso = this.now();
    await database.runAsync(
      `INSERT INTO dentist_reminders
        (child_profile_id, first_due_at, second_due_at, first_notification_id,
         second_notification_id, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?)
       ON CONFLICT(child_profile_id) DO NOTHING`,
      childProfileId,
      addCalendarMonths(nowIso, 6),
      addCalendarMonths(nowIso, 12),
      nowIso,
      nowIso,
    );
  }
}

const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('dentist-reminders', {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: i18n.t('parent.dentistReminder.channelName'),
  });
};

const scheduleOneShot = async (input: {
  body: string;
  childProfileId: string;
  fireAt: Date;
  kind: 'routine' | 'appointment';
  title: string;
}): Promise<string> => {
  await ensureAndroidChannel();
  return Notifications.scheduleNotificationAsync({
    content: {
      body: input.body,
      data: { childProfileId: input.childProfileId, dentistVisitReminder: input.kind },
      sound: 'default',
      title: input.title,
    },
    trigger: {
      channelId: Platform.OS === 'android' ? 'dentist-reminders' : undefined,
      date: input.fireAt,
      type: Notifications.SchedulableTriggerInputTypes.DATE,
    },
  });
};

const expoDentistVisitGateway: DentistVisitGateway = {
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async getPermission() {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return 'granted';
    return permission.canAskAgain ? 'undetermined' : 'denied';
  },
  scheduleAppointment({ childProfileId, nickname, fireAt }) {
    return scheduleOneShot({
      body: i18n.t('parent.dentistVisits.notifications.appointmentBody', { childName: nickname }),
      childProfileId,
      fireAt,
      kind: 'appointment',
      title: i18n.t('parent.dentistVisits.notifications.appointmentTitle', { childName: nickname }),
    });
  },
  scheduleRoutine({ childProfileId, nickname, fireAt }) {
    return scheduleOneShot({
      body: i18n.t('parent.dentistVisits.notifications.routineBody', { childName: nickname }),
      childProfileId,
      fireAt,
      kind: 'routine',
      title: i18n.t('parent.dentistVisits.notifications.routineTitle', { childName: nickname }),
    });
  },
};

export const dentistVisitService = new DentistVisitService();
