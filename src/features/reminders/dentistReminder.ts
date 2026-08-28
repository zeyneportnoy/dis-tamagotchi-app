import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getDatabase } from '@/data/db';
import i18n from '@/i18n';

type DentistReminderRow = {
  first_due_at: string;
  first_notification_id: string | null;
  second_due_at: string;
  second_notification_id: string | null;
};

type ReminderDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;
type DentistNotificationGateway = {
  getPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  schedule(input: {
    childProfileId: string;
    date: Date;
    nickname: string;
    occurrence: 'first' | 'second';
  }): Promise<string>;
};

export type DentistReminderResult = Readonly<{
  firstDueAt: string;
  scheduled: boolean;
}>;

export class DentistReminderService {
  constructor(
    private readonly database: () => Promise<ReminderDatabase> = getDatabase,
    private readonly notifications: DentistNotificationGateway = dentistNotificationGateway,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async ensureScheduledForProfile(profile: {
    id: string;
    nickname: string;
  }): Promise<DentistReminderResult> {
    const database = await this.database();
    const reminder = await database.getFirstAsync<DentistReminderRow>(
      `SELECT first_due_at, second_due_at, first_notification_id, second_notification_id
       FROM dentist_reminders WHERE child_profile_id = ?`,
      profile.id,
    );
    if (!reminder) throw new Error('DENTIST_REMINDER_NOT_FOUND');

    let firstNotificationId = reminder.first_notification_id;
    let secondNotificationId = reminder.second_notification_id;
    let permission: 'granted' | 'denied' | 'undetermined';
    try {
      permission = await this.notifications.getPermission();
    } catch {
      return { firstDueAt: reminder.first_due_at, scheduled: false };
    }
    if (permission !== 'granted') {
      return { firstDueAt: reminder.first_due_at, scheduled: false };
    }

    const scheduleOccurrence = async (
      occurrence: 'first' | 'second',
      dueAt: string,
    ): Promise<string | null> => {
      try {
        const notificationId = await this.notifications.schedule({
          childProfileId: profile.id,
          date: new Date(dueAt),
          nickname: profile.nickname,
          occurrence,
        });
        await database.runAsync(
          `UPDATE dentist_reminders
           SET ${occurrence}_notification_id = ?, updated_at = ?
           WHERE child_profile_id = ?`,
          notificationId,
          this.now(),
          profile.id,
        );
        return notificationId;
      } catch {
        return null;
      }
    };

    firstNotificationId ??= await scheduleOccurrence('first', reminder.first_due_at);
    secondNotificationId ??= await scheduleOccurrence('second', reminder.second_due_at);
    return {
      firstDueAt: reminder.first_due_at,
      scheduled: firstNotificationId !== null && secondNotificationId !== null,
    };
  }
}

const dentistNotificationGateway: DentistNotificationGateway = {
  async getPermission() {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return 'granted';
    return permission.canAskAgain ? 'undetermined' : 'denied';
  },
  async schedule({ childProfileId, date, nickname, occurrence }) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('dentist-reminders', {
        importance: Notifications.AndroidImportance.DEFAULT,
        name: i18n.t('parent.dentistReminder.channelName'),
      });
    }
    return Notifications.scheduleNotificationAsync({
      content: {
        body: i18n.t('parent.dentistReminder.notificationBody', { nickname }),
        data: { childProfileId, dentistReminderOccurrence: occurrence },
        sound: 'default',
        title: i18n.t('parent.dentistReminder.notificationTitle'),
      },
      trigger: {
        channelId: Platform.OS === 'android' ? 'dentist-reminders' : undefined,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        month: date.getMonth(),
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      },
    });
  },
};

export const dentistReminderService = new DentistReminderService();
