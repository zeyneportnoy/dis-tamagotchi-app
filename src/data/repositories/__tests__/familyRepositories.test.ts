import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SQLiteDatabase } from 'expo-sqlite';

import { FamilyUseCases } from '@/application/family';
import { migrateDatabase } from '@/data/db';
import { ageBandSchema, nicknameSchema } from '@/domain/family';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteChildProfileRepository } from '../SQLiteChildProfileRepository';
import { SQLiteFamilyRepository } from '../SQLiteFamilyRepository';
import { SQLiteProfileProgressRepository } from '../SQLiteProfileProgressRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-sqlite', () => ({}));

const familyId = '00000000-0000-4000-8000-000000000001';
const profileIds = [
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013',
] as const;
const now = () => '2026-08-02T12:00:00.000Z';
const parentId = '10000000-0000-4000-8000-000000000001';

function repositories(database: NodeSQLiteDatabase) {
  let profileIndex = 0;
  const sqlite = database as unknown as SQLiteDatabase;
  return {
    families: new SQLiteFamilyRepository(sqlite, () => familyId, now),
    profiles: new SQLiteChildProfileRepository(
      sqlite,
      () => profileIds[profileIndex++] ?? '00000000-0000-4000-8000-000000000099',
      now,
      async () => parentId,
    ),
  };
}

describe('family repositories', () => {
  it('creates one local family on first use and supports three profiles', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const { families, profiles } = repositories(database);
    const useCases = new FamilyUseCases(families, profiles);

    await useCases.createProfile({
      nickname: 'Ege',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    await useCases.createProfile({
      nickname: 'Ada',
      ageBand: '7_11',
      avatarId: 'akil',
    });
    await useCases.createProfile({
      nickname: 'Can',
      ageBand: '4_6',
      avatarId: 'kaan',
    });

    expect((await useCases.listProfiles()).map((profile) => profile.nickname)).toEqual([
      'Ege',
      'Ada',
      'Can',
    ]);
    const familyCount = await database.getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM families',
    );
    expect(familyCount?.count).toBe(1);
    await expect(
      database.getAllAsync<{
        child_profile_id: string;
        first_due_at: string;
        second_due_at: string;
      }>(
        `SELECT child_profile_id, first_due_at, second_due_at
         FROM dentist_reminders ORDER BY child_profile_id`,
      ),
    ).resolves.toEqual([
      {
        child_profile_id: profileIds[0],
        first_due_at: '2027-02-02T12:00:00.000Z',
        second_due_at: '2027-08-02T12:00:00.000Z',
      },
      {
        child_profile_id: profileIds[1],
        first_due_at: '2027-02-02T12:00:00.000Z',
        second_due_at: '2027-08-02T12:00:00.000Z',
      },
      {
        child_profile_id: profileIds[2],
        first_due_at: '2027-02-02T12:00:00.000Z',
        second_due_at: '2027-08-02T12:00:00.000Z',
      },
    ]);
    database.close();
  });

  it('persists profile creation and active selection after reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dis-tamagotchi-db-'));
    const path = join(directory, 'test.db');
    const first = new NodeSQLiteDatabase(path);
    await migrateDatabase(first as unknown as SQLiteDatabase);
    const firstRepositories = repositories(first);
    const firstUseCases = new FamilyUseCases(
      firstRepositories.families,
      firstRepositories.profiles,
    );
    await firstUseCases.createProfile({
      nickname: 'Ege',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    await firstUseCases.createProfile({
      nickname: 'Ada',
      ageBand: '7_11',
      avatarId: 'akil',
    });
    await firstUseCases.selectActiveProfile(profileIds[0]);
    first.close();

    const reopened = new NodeSQLiteDatabase(path);
    await migrateDatabase(reopened as unknown as SQLiteDatabase);
    const reopenedRepositories = repositories(reopened);
    const reopenedUseCases = new FamilyUseCases(
      reopenedRepositories.families,
      reopenedRepositories.profiles,
    );
    await expect(reopenedUseCases.getActiveProfile()).resolves.toMatchObject({
      id: profileIds[0],
      nickname: 'Ege',
      avatarId: 'inci',
    });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('persists separate character choices for different profiles', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const { families, profiles } = repositories(database);
    const family = await families.createLocal();
    const first = await profiles.create({
      familyId: family.id,
      nickname: 'Ege',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    const second = await profiles.create({
      familyId: family.id,
      nickname: 'Ada',
      ageBand: '7_11',
      avatarId: 'kaan',
    });

    await profiles.selectActive(first.id);
    await expect(profiles.getActive()).resolves.toMatchObject({ avatarId: 'inci' });
    await profiles.selectActive(second.id);
    await expect(profiles.getActive()).resolves.toMatchObject({ avatarId: 'kaan' });
    database.close();
  });

  it('persists morning and evening brushing state after reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dis-tamagotchi-progress-db-'));
    const path = join(directory, 'test.db');
    const first = new NodeSQLiteDatabase(path);
    await migrateDatabase(first as unknown as SQLiteDatabase);
    const firstRepositories = repositories(first);
    const family = await firstRepositories.families.createLocal();
    const profile = await firstRepositories.profiles.create({
      familyId: family.id,
      nickname: 'Ege',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    const now = () => new Date('2026-08-08T07:30:00.000Z');
    const progress = new SQLiteProfileProgressRepository(first as unknown as SQLiteDatabase, now);
    await progress.setBrushingCompleted(profile.id, 'morning', true);
    await progress.setBrushingCompleted(profile.id, 'evening', true);
    first.close();

    const reopened = new NodeSQLiteDatabase(path);
    await migrateDatabase(reopened as unknown as SQLiteDatabase);
    const reopenedProgress = new SQLiteProfileProgressRepository(
      reopened as unknown as SQLiteDatabase,
      now,
    );
    await expect(reopenedProgress.get(profile.id)).resolves.toMatchObject({
      childProfileId: profile.id,
      morningCompleted: true,
      eveningCompleted: true,
      lastBrushingAt: '2026-08-08T07:30:00.000Z',
    });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads card completion from daily progress and starts a new day waiting', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const { families, profiles } = repositories(database);
    const family = await families.createLocal();
    const profile = await profiles.create({
      familyId: family.id,
      nickname: 'Ege',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    let current = new Date(2026, 7, 8, 8, 30);
    const progress = new SQLiteProfileProgressRepository(
      database as unknown as SQLiteDatabase,
      () => current,
    );
    await progress.setBrushingCompleted(profile.id, 'morning', true);
    await expect(progress.get(profile.id)).resolves.toMatchObject({
      statusDate: '2026-08-08',
      morningCompleted: true,
      eveningCompleted: false,
    });
    current = new Date(2026, 7, 9, 8, 30);
    await expect(progress.get(profile.id)).resolves.toMatchObject({
      statusDate: '2026-08-09',
      morningCompleted: false,
      eveningCompleted: false,
    });
    await expect(
      database.getFirstAsync<{ morning_completed: number }>(
        `SELECT morning_completed FROM daily_progress
         WHERE child_profile_id = ? AND local_day_key = '2026-08-08'`,
        profile.id,
      ),
    ).resolves.toEqual({ morning_completed: 1 });
    database.close();
  });

  it('persists a required legacy age-band update and keeps the active profile', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dis-tamagotchi-legacy-db-'));
    const path = join(directory, 'test.db');
    const first = new NodeSQLiteDatabase(path);
    await migrateDatabase(first as unknown as SQLiteDatabase);
    const firstRepositories = repositories(first);
    const family = await firstRepositories.families.createLocal();
    await first.runAsync(
      `INSERT INTO child_profiles
        (id, family_id, nickname, age_band, avatar_id, created_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      profileIds[0],
      family.id,
      'Ege',
      '6_8',
      'inci',
      now(),
    );
    await first.runAsync(
      `UPDATE child_profiles
       SET parent_auth_user_id = ?, sync_status = 'synced'
       WHERE id = ?`,
      parentId,
      profileIds[0],
    );
    await firstRepositories.profiles.selectActive(profileIds[0]);
    const firstUseCases = new FamilyUseCases(
      firstRepositories.families,
      firstRepositories.profiles,
    );
    await expect(firstUseCases.getActiveProfile()).resolves.toMatchObject({ ageBand: '6_8' });
    await firstUseCases.updateProfile(profileIds[0], { ageBand: '7_11' });
    first.close();

    const reopened = new NodeSQLiteDatabase(path);
    await migrateDatabase(reopened as unknown as SQLiteDatabase);
    const reopenedRepositories = repositories(reopened);
    const reopenedUseCases = new FamilyUseCases(
      reopenedRepositories.families,
      reopenedRepositories.profiles,
    );
    await expect(reopenedUseCases.getActiveProfile()).resolves.toMatchObject({
      id: profileIds[0],
      ageBand: '7_11',
    });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('allows duplicate nicknames in one family and keeps profile identity distinct', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const { families, profiles } = repositories(database);
    const family = await families.createLocal();

    const first = await profiles.create({
      familyId: family.id,
      nickname: 'Ege',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    const second = await profiles.create({
      familyId: family.id,
      nickname: 'Ege',
      ageBand: '7_11',
      avatarId: 'akil',
    });

    expect(first.id).not.toBe(second.id);
    const listedProfiles = await profiles.list(family.id);
    expect(listedProfiles).toHaveLength(2);
    expect(listedProfiles).toEqual(expect.arrayContaining([first, second]));
    await profiles.selectActive(first.id);
    await expect(profiles.getActive()).resolves.toEqual(first);
    database.close();
  });

  it('enforces the family foreign key', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const { profiles } = repositories(database);
    await expect(
      profiles.create({
        familyId: '00000000-0000-4000-8000-000000000099',
        nickname: 'Ege',
        ageBand: '4_6',
        avatarId: 'inci',
      }),
    ).rejects.toThrow();
    database.close();
  });

  it('updates, archives and deletes a profile transactionally', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const { families, profiles } = repositories(database);
    const family = await families.createLocal();
    const profile = await profiles.create({
      familyId: family.id,
      nickname: 'Ege',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    await expect(profiles.update(profile.id, { nickname: 'Ege 2' })).resolves.toMatchObject({
      nickname: 'Ege 2',
    });
    await profiles.archive(profile.id);
    await expect(profiles.list(family.id)).resolves.toEqual([]);
    await expect(profiles.getActive()).resolves.toBeNull();
    await profiles.delete(profile.id);
    const count = await database.getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM child_profiles',
    );
    expect(count?.count).toBe(0);
    database.close();
  });

  it('isolates list, active selection, update, archive and delete by active parent', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const sqlite = database as unknown as SQLiteDatabase;
    const families = new SQLiteFamilyRepository(sqlite, () => familyId, now);
    const family = await families.createLocal();
    let activeParentId = 'parent-a';
    let nextId = 0;
    const profiles = new SQLiteChildProfileRepository(
      sqlite,
      () => `00000000-0000-4000-8000-00000000002${++nextId}`,
      now,
      async () => activeParentId,
    );

    const profileA = await profiles.create({
      familyId: family.id,
      nickname: 'A child',
      ageBand: '4_6',
      avatarId: 'inci',
    });
    activeParentId = 'parent-b';
    await expect(profiles.list(family.id)).resolves.toEqual([]);
    await expect(profiles.getActive()).resolves.toBeNull();
    await expect(profiles.selectActive(profileA.id)).rejects.toThrow('PROFILE_NOT_FOUND');
    await expect(profiles.update(profileA.id, { nickname: 'Changed' })).rejects.toThrow(
      'PROFILE_NOT_FOUND',
    );
    await expect(profiles.archive(profileA.id)).rejects.toThrow('PROFILE_NOT_FOUND');
    await expect(profiles.delete(profileA.id)).rejects.toThrow('PROFILE_NOT_FOUND');

    const profileB = await profiles.create({
      familyId: family.id,
      nickname: 'B child',
      ageBand: '7_11',
      avatarId: 'kaan',
    });
    await expect(profiles.list(family.id)).resolves.toEqual([profileB]);
    activeParentId = 'parent-a';
    await expect(profiles.list(family.id)).resolves.toEqual([profileA]);
    await expect(profiles.getActive()).resolves.toEqual(profileA);
    database.close();
  });
});

describe('profile validation', () => {
  it('rejects an invalid age band', () => {
    expect(ageBandSchema.safeParse('5_7').success).toBe(false);
    expect(ageBandSchema.safeParse('6_8').success).toBe(false);
    expect(ageBandSchema.safeParse('9_10').success).toBe(false);
  });

  it('rejects empty and out-of-range nicknames', () => {
    expect(nicknameSchema.safeParse('   ').success).toBe(false);
    expect(nicknameSchema.safeParse('a'.repeat(21)).success).toBe(false);
  });
});
