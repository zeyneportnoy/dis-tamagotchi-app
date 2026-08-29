import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import type { CloudChildProfile } from '@/domain/sync';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteProfileSyncRepository } from '../SQLiteProfileSyncRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-0000000000fa') }));
jest.mock('expo-sqlite', () => ({}));

const parentId = '10000000-0000-4000-8000-000000000001';
const cloudProfile: CloudChildProfile = {
  id: '20000000-0000-4000-8000-000000000001',
  parentId,
  nickname: 'Emrah',
  dateOfBirth: '2017-03-15',
  ageBand: '7_11',
  createdAt: '2026-08-02T12:00:00.000Z',
  updatedAt: '2026-08-02T12:00:00.000Z',
  archivedAt: null,
  avatarId: 'inci',
};

describe('SQLiteProfileSyncRepository.upsertCloud', () => {
  it('bootstraps a local family when none exists so cloud recovery can run on a fresh install', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const repository = new SQLiteProfileSyncRepository(database as unknown as SQLiteDatabase);

    await expect(repository.upsertCloud(cloudProfile)).resolves.toBeUndefined();

    const families = await (database as unknown as SQLiteDatabase).getAllAsync<{ id: string }>(
      'SELECT id FROM families',
    );
    expect(families).toHaveLength(1);
    const familyId = families[0]?.id;
    expect(familyId).toEqual(expect.any(String));

    const stored = await (database as unknown as SQLiteDatabase).getFirstAsync<{
      family_id: string;
      nickname: string;
      date_of_birth: string | null;
      sync_status: string;
    }>(
      'SELECT family_id, nickname, date_of_birth, sync_status FROM child_profiles WHERE id = ?',
      cloudProfile.id,
    );
    expect(stored).toEqual({
      family_id: familyId,
      nickname: 'Emrah',
      date_of_birth: '2017-03-15',
      sync_status: 'synced',
    });
  });

  it('reuses the existing local family on subsequent recoveries', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const repository = new SQLiteProfileSyncRepository(database as unknown as SQLiteDatabase);

    await repository.upsertCloud(cloudProfile);
    await repository.upsertCloud({ ...cloudProfile, id: '20000000-0000-4000-8000-000000000002', nickname: 'Ada' });

    const families = await (database as unknown as SQLiteDatabase).getAllAsync('SELECT id FROM families');
    expect(families).toHaveLength(1);
  });
});
