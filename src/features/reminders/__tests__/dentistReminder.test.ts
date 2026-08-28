import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import { SQLiteChildProfileRepository, SQLiteFamilyRepository } from '@/data/repositories';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { DentistReminderService } from '../dentistReminder';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { YEARLY: 'yearly' },
}));

const parentId = '10000000-0000-4000-8000-000000000001';
const now = () => '2026-08-28T09:30:00.000Z';

async function createHarness(permission: 'granted' | 'denied') {
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
    ageBand: '4_6',
    avatarId: 'inci',
    familyId: family.id,
    nickname: 'Ege',
  });
  let notificationIndex = 0;
  const notifications = {
    getPermission: jest.fn(() => Promise.resolve(permission)),
    schedule: jest.fn(() => Promise.resolve(`dentist-${(notificationIndex += 1)}`)),
  };
  const service = new DentistReminderService(
    async () => sqlite,
    notifications,
    () => '2026-08-28T09:31:00.000Z',
  );
  return { database, notifications, profile, service };
}

describe('child-specific dentist reminders', () => {
  it('schedules two annual anchors that form a six-month cycle', async () => {
    const { database, notifications, profile, service } = await createHarness('granted');

    await expect(service.ensureScheduledForProfile(profile)).resolves.toEqual({
      firstDueAt: '2027-02-28T09:30:00.000Z',
      scheduled: true,
    });
    expect(notifications.schedule).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        childProfileId: profile.id,
        date: new Date('2027-02-28T09:30:00.000Z'),
        nickname: 'Ege',
        occurrence: 'first',
      }),
    );
    expect(notifications.schedule).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        childProfileId: profile.id,
        date: new Date('2027-08-28T09:30:00.000Z'),
        nickname: 'Ege',
        occurrence: 'second',
      }),
    );
    await expect(
      database.getFirstAsync<{
        first_notification_id: string;
        second_notification_id: string;
      }>('SELECT first_notification_id, second_notification_id FROM dentist_reminders'),
    ).resolves.toEqual({
      first_notification_id: 'dentist-1',
      second_notification_id: 'dentist-2',
    });
    database.close();
  });

  it('keeps the local due date when notification permission is unavailable', async () => {
    const { database, notifications, profile, service } = await createHarness('denied');

    await expect(service.ensureScheduledForProfile(profile)).resolves.toEqual({
      firstDueAt: '2027-02-28T09:30:00.000Z',
      scheduled: false,
    });
    expect(notifications.schedule).not.toHaveBeenCalled();
    await expect(
      database.getFirstAsync<{ first_due_at: string }>(
        'SELECT first_due_at FROM dentist_reminders WHERE child_profile_id = ?',
        profile.id,
      ),
    ).resolves.toEqual({ first_due_at: '2027-02-28T09:30:00.000Z' });
    database.close();
  });
});
