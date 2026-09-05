import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import { SQLiteChildProfileRepository, SQLiteFamilyRepository } from '@/data/repositories';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { DentistVisitService } from '../dentistVisit';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const parentId = '10000000-0000-4000-8000-000000000001';
const now = () => '2026-08-28T09:30:00.000Z';

// Recovered dates land far enough in the future that the service's own
// "don't schedule a reminder already in the past" guard (which reads the
// real wall clock, not the injected `now`) stays true for a long time.
const futureLastVisitDate = '2030-06-01';
const futureNextAppointmentDate = '2030-12-01';

async function createHarness(
  options: Readonly<{ permission?: 'granted' | 'denied'; serviceNow?: () => string }> = {},
) {
  const { permission = 'granted', serviceNow = now } = options;
  const database = new NodeSQLiteDatabase();
  await migrateDatabase(database as unknown as SQLiteDatabase);
  const sqlite = database as unknown as SQLiteDatabase;
  const families = new SQLiteFamilyRepository(
    sqlite,
    () => '00000000-0000-4000-8000-000000000001',
    now,
  );
  const profiles = new SQLiteChildProfileRepository(
    sqlite,
    () => '00000000-0000-4000-8000-000000000011',
    now,
    async () => parentId,
  );
  const family = await families.createLocal();
  const profile = await profiles.create({
    dateOfBirth: '2020-01-15',
    avatarId: 'inci',
    familyId: family.id,
    nickname: 'Ege',
  });
  let notificationIndex = 0;
  const notifications = {
    cancel: jest.fn(() => Promise.resolve()),
    getPermission: jest.fn(() => Promise.resolve(permission)),
    scheduleAppointment: jest.fn(() => Promise.resolve(`appointment-${(notificationIndex += 1)}`)),
    scheduleRoutine: jest.fn(() => Promise.resolve(`routine-${(notificationIndex += 1)}`)),
  };
  // serviceNow models the RECOVERY moment, distinct from `now` (the child's
  // real created_at) — the two coincide for a locally-created child but must
  // NOT coincide for a second device recovering a child created long ago.
  const service = new DentistVisitService(async () => sqlite, notifications, serviceNow);
  return { database, notifications, profile, service };
}

describe('DentistVisitService.applyRecovered', () => {
  it('persists both recovered dates and schedules both notifications, like a live parent edit', async () => {
    const { database, notifications, profile, service } = await createHarness();

    await service.applyRecovered(
      { id: profile.id, nickname: profile.nickname },
      { lastVisitDate: futureLastVisitDate, nextAppointmentDate: futureNextAppointmentDate },
    );

    await expect(service.get(profile.id)).resolves.toEqual({
      appointmentReminderDate: '2030-11-30',
      appointmentScheduled: true,
      lastVisitDate: futureLastVisitDate,
      nextAppointmentDate: futureNextAppointmentDate,
      routineDueDate: '2030-12-01',
      routineScheduled: true,
    });
    expect(notifications.scheduleRoutine).toHaveBeenCalledWith(
      expect.objectContaining({ childProfileId: profile.id, nickname: 'Ege' }),
    );
    expect(notifications.scheduleAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ childProfileId: profile.id, nickname: 'Ege' }),
    );
    database.close();
  });

  it('recovers only the last-visit date when no appointment was ever entered', async () => {
    const { database, notifications, profile, service } = await createHarness();

    await service.applyRecovered(
      { id: profile.id, nickname: profile.nickname },
      { lastVisitDate: futureLastVisitDate, nextAppointmentDate: null },
    );

    const state = await service.get(profile.id);
    expect(state.lastVisitDate).toBe(futureLastVisitDate);
    expect(state.nextAppointmentDate).toBeNull();
    expect(notifications.scheduleAppointment).not.toHaveBeenCalled();
    database.close();
  });

  it('still marks the child as resolved when neither date was ever entered (no dates invented)', async () => {
    const { database, notifications, profile, service } = await createHarness();

    await service.applyRecovered(
      { id: profile.id, nickname: profile.nickname },
      { lastVisitDate: null, nextAppointmentDate: null },
    );

    const state = await service.get(profile.id);
    expect(state.lastVisitDate).toBeNull();
    expect(state.nextAppointmentDate).toBeNull();
    expect(notifications.scheduleRoutine).not.toHaveBeenCalled();
    expect(notifications.scheduleAppointment).not.toHaveBeenCalled();
    // The row now exists, so a second recovery pass never re-attempts this —
    // it reads as "resolved" via dentistReminderEnabled.
    await expect(
      database.getFirstAsync<{ child_profile_id: string }>(
        'SELECT child_profile_id FROM dentist_reminders WHERE child_profile_id = ?',
        profile.id,
      ),
    ).resolves.not.toBeNull();
    database.close();
  });

  it("anchors the generic fallback due dates to the child's real created_at, not the recovery moment", async () => {
    // The child was created (on device A) at `now` ('2026-08-28T09:30:00.000Z'),
    // which is also when device A's OWN local dentist_reminders row got its
    // first_due_at/second_due_at (via SQLiteChildProfileRepository.create()'s
    // unconditional insert). A genuinely fresh second device has the RECOVERED
    // child_profiles row but NO local dentist_reminders row yet — simulated
    // here by deleting the one `create()` made, so ensureRow's INSERT actually
    // runs (ON CONFLICT DO NOTHING would otherwise mask this entirely). This
    // device's own clock is used for every OTHER timestamp (updated_at,
    // notification scheduling), but the due-date anchor must still come from
    // created_at so both devices land on the exact same first/second due date.
    const recoveryMoment = () => '2027-03-15T12:00:00.000Z';
    const { database, profile, service } = await createHarness({ serviceNow: recoveryMoment });
    await database.runAsync(
      'DELETE FROM dentist_reminders WHERE child_profile_id = ?',
      profile.id,
    );

    await service.applyRecovered(
      { id: profile.id, nickname: profile.nickname },
      { lastVisitDate: null, nextAppointmentDate: null },
    );

    const row = await database.getFirstAsync<{ first_due_at: string; second_due_at: string }>(
      'SELECT first_due_at, second_due_at FROM dentist_reminders WHERE child_profile_id = ?',
      profile.id,
    );
    // created_at ('2026-08-28T09:30:00.000Z') + 6 / 12 months — NOT anything
    // derived from the 2027-03-15 recovery moment.
    expect(row?.first_due_at).toBe('2027-02-28T09:30:00.000Z');
    expect(row?.second_due_at).toBe('2027-08-28T09:30:00.000Z');
    database.close();
  });

  it('does not clobber an already-set next appointment when only the last visit is recovered', async () => {
    const { database, profile, service } = await createHarness();
    await service.setNextAppointmentDate(
      { id: profile.id, nickname: profile.nickname },
      futureNextAppointmentDate,
    );

    await service.applyRecovered(
      { id: profile.id, nickname: profile.nickname },
      { lastVisitDate: futureLastVisitDate, nextAppointmentDate: null },
    );

    const state = await service.get(profile.id);
    expect(state.lastVisitDate).toBe(futureLastVisitDate);
    expect(state.nextAppointmentDate).toBe(futureNextAppointmentDate);
    database.close();
  });
});
