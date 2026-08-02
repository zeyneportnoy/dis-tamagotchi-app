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

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-sqlite', () => ({}));

const familyId = '00000000-0000-4000-8000-000000000001';
const profileIds = [
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013',
] as const;
const now = () => '2026-08-02T12:00:00.000Z';

function repositories(database: NodeSQLiteDatabase) {
  let profileIndex = 0;
  const sqlite = database as unknown as SQLiteDatabase;
  return {
    families: new SQLiteFamilyRepository(sqlite, () => familyId, now),
    profiles: new SQLiteChildProfileRepository(
      sqlite,
      () => profileIds[profileIndex++] ?? '00000000-0000-4000-8000-000000000099',
      now,
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
      ageBand: '6_8',
      avatarId: 'cheerful-incisor',
    });
    await useCases.createProfile({
      nickname: 'Ada',
      ageBand: '9_10',
      avatarId: 'sleepy-molar',
    });
    await useCases.createProfile({
      nickname: 'Can',
      ageBand: '6_8',
      avatarId: 'brave-canine',
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
      ageBand: '6_8',
      avatarId: 'cheerful-incisor',
    });
    await firstUseCases.createProfile({
      nickname: 'Ada',
      ageBand: '9_10',
      avatarId: 'sleepy-molar',
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
      ageBand: '6_8',
      avatarId: 'cheerful-incisor',
    });
    const second = await profiles.create({
      familyId: family.id,
      nickname: 'Ege',
      ageBand: '9_10',
      avatarId: 'sleepy-molar',
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
        ageBand: '6_8',
        avatarId: 'cheerful-incisor',
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
      ageBand: '6_8',
      avatarId: 'cheerful-incisor',
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
});

describe('profile validation', () => {
  it('rejects an invalid age band', () => {
    expect(ageBandSchema.safeParse('5_7').success).toBe(false);
  });

  it('rejects empty and out-of-range nicknames', () => {
    expect(nicknameSchema.safeParse('   ').success).toBe(false);
    expect(nicknameSchema.safeParse('a'.repeat(21)).success).toBe(false);
  });
});
