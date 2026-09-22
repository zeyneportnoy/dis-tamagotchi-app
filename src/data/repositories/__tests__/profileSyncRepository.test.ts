import type { SQLiteDatabase } from 'expo-sqlite';

import { ProfileSyncUseCases } from '@/application/sync/ProfileSyncUseCases';
import { migrateDatabase } from '@/data/db';
import type { CloudChildProfile, CloudChildProfileRepository } from '@/domain/sync';
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

  describe('stale-cloud overwrite protection (P1 fix)', () => {
    async function seedSyncedRow(
      database: NodeSQLiteDatabase,
      overrides: Partial<{
        nickname: string;
        avatarId: string;
        ageBand: string;
        archivedAt: string | null;
        syncStatus: string;
      }> = {},
    ): Promise<void> {
      const sqlite = database as unknown as SQLiteDatabase;
      await sqlite.runAsync(
        `INSERT INTO families (id, created_at, locale, timezone) VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
      );
      await sqlite.runAsync(
        `INSERT INTO child_profiles
          (id, family_id, nickname, date_of_birth, age_band, avatar_id, created_at, archived_at,
           remote_id, parent_auth_user_id, sync_status, updated_at)
         VALUES (?, 'family-1', ?, '2017-03-15', ?, ?, '2026-08-01T00:00:00.000Z', ?, ?, ?, ?, '2026-08-29T09:00:00.000Z')`,
        cloudProfile.id,
        overrides.nickname ?? 'Emrah',
        overrides.ageBand ?? '7_11',
        overrides.avatarId ?? 'inci',
        overrides.archivedAt ?? null,
        cloudProfile.id,
        parentId,
        overrides.syncStatus ?? 'synced',
      );
    }

    async function readRow(database: NodeSQLiteDatabase) {
      return (database as unknown as SQLiteDatabase).getFirstAsync<{
        nickname: string;
        age_band: string;
        avatar_id: string;
        archived_at: string | null;
        sync_status: string;
        updated_at: string;
      }>(
        `SELECT nickname, age_band, avatar_id, archived_at, sync_status, updated_at
         FROM child_profiles WHERE id = ?`,
        cloudProfile.id,
      );
    }

    it('never lets a stale cloud row overwrite a pending local edit (nickname/avatar/age_band)', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      // Parent just renamed the child locally; push has not reached the cloud yet.
      await seedSyncedRow(database, { nickname: 'Yeni Isim', avatarId: 'piril', syncStatus: 'pending' });
      const repository = new SQLiteProfileSyncRepository(database as unknown as SQLiteDatabase);

      // Bootstrap's recoverFromCloud() runs with the STALE pre-edit cloud row.
      await repository.upsertCloud(cloudProfile); // nickname: 'Emrah', avatarId: 'inci'

      const row = await readRow(database);
      expect(row?.nickname).toBe('Yeni Isim'); // local edit survives
      expect(row?.avatar_id).toBe('piril'); // local edit survives
      // sync_status stays 'pending' so the real edit is retried, never silently
      // marked as if it had already reached the cloud.
      expect(row?.sync_status).toBe('pending');
    });

    it('keeps the edit pending through 100 repeated stale-cloud recovery passes', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedSyncedRow(database, { nickname: 'Yeni Isim', syncStatus: 'pending' });
      const repository = new SQLiteProfileSyncRepository(database as unknown as SQLiteDatabase);

      for (let i = 0; i < 100; i += 1) {
        await repository.upsertCloud(cloudProfile);
        const row = await readRow(database);
        expect(row?.nickname).toBe('Yeni Isim');
        expect(row?.sync_status).toBe('pending');
      }
    });

    it('accepts the cloud value once the local row is clean (sync_status "synced")', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      // No pending local edit — this device's own earlier push already matches
      // the cloud, or another device made a legitimate change.
      await seedSyncedRow(database, { nickname: 'Eski Isim', syncStatus: 'synced' });
      const repository = new SQLiteProfileSyncRepository(database as unknown as SQLiteDatabase);

      await repository.upsertCloud(cloudProfile); // nickname: 'Emrah'

      const row = await readRow(database);
      expect(row?.nickname).toBe('Emrah');
      expect(row?.sync_status).toBe('synced');
    });

    it('clears a stale local date_of_birth to NULL when the cloud row has none, while keeping the explicit age_band', async () => {
      const database = new NodeSQLiteDatabase();
      const sqlite = database as unknown as SQLiteDatabase;
      await migrateDatabase(sqlite);
      await sqlite.runAsync(
        `INSERT INTO families (id, created_at, locale, timezone) VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
      );
      // A device that collected a real birth date before the product stopped
      // doing so: local still has one, sync_status is 'synced' (no pending edit).
      await sqlite.runAsync(
        `INSERT INTO child_profiles
          (id, family_id, nickname, date_of_birth, age_band, avatar_id, created_at, archived_at,
           remote_id, parent_auth_user_id, sync_status, updated_at)
         VALUES (?, 'family-1', 'Emrah', '2017-03-15', '7_11', 'inci', '2026-08-01T00:00:00.000Z',
           NULL, ?, ?, 'synced', '2026-08-29T09:00:00.000Z')`,
        cloudProfile.id,
        cloudProfile.id,
        parentId,
      );
      const repository = new SQLiteProfileSyncRepository(sqlite);

      // The cloud row (never wrote date_of_birth) carries the same explicit
      // age_band but no birth date at all.
      await repository.upsertCloud({ ...cloudProfile, dateOfBirth: null, ageBand: '7_11' });

      const row = await sqlite.getFirstAsync<{ date_of_birth: string | null; age_band: string }>(
        'SELECT date_of_birth, age_band FROM child_profiles WHERE id = ?',
        cloudProfile.id,
      );
      expect(row?.date_of_birth).toBeNull();
      expect(row?.age_band).toBe('7_11');
    });

    it.each(['pending', 'failed'] as const)(
      'a null cloud date_of_birth clears local DOB even mid-edit (sync_status "%s"), while age_band still keeps its own pending/failed guard',
      async (syncStatus) => {
        const database = new NodeSQLiteDatabase();
        const sqlite = database as unknown as SQLiteDatabase;
        await migrateDatabase(sqlite);
        await sqlite.runAsync(
          `INSERT INTO families (id, created_at, locale, timezone) VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
        );
        // A not-yet-pushed local nickname/avatar/age_band edit is in flight
        // (sync_status pending/failed) — unrelated to date_of_birth, which the
        // product no longer collects or edits at all.
        await sqlite.runAsync(
          `INSERT INTO child_profiles
            (id, family_id, nickname, date_of_birth, age_band, avatar_id, created_at, archived_at,
             remote_id, parent_auth_user_id, sync_status, updated_at)
           VALUES (?, 'family-1', 'Yeni Isim', '2017-03-15', '7_11', 'inci', '2026-08-01T00:00:00.000Z',
             NULL, ?, ?, ?, '2026-08-29T09:00:00.000Z')`,
          cloudProfile.id,
          cloudProfile.id,
          parentId,
          syncStatus,
        );
        const repository = new SQLiteProfileSyncRepository(sqlite);

        // Stale pre-edit cloud row: different nickname/age_band, no DOB.
        await repository.upsertCloud({ ...cloudProfile, dateOfBirth: null, ageBand: '4_6' });

        const row = await sqlite.getFirstAsync<{
          date_of_birth: string | null;
          age_band: string;
          nickname: string;
          sync_status: string;
        }>(
          'SELECT date_of_birth, age_band, nickname, sync_status FROM child_profiles WHERE id = ?',
          cloudProfile.id,
        );
        expect(row?.date_of_birth).toBeNull(); // cloud DOB wins unconditionally
        expect(row?.age_band).toBe('7_11'); // pending/failed local edit still protected
        expect(row?.nickname).toBe('Yeni Isim'); // pending/failed local edit still protected
        expect(row?.sync_status).toBe(syncStatus); // still retried, not silently marked synced
      },
    );

    it('never resurrects a locally-archived child while its removal is still pending in the outbox', async () => {
      const database = new NodeSQLiteDatabase();
      const sqlite = database as unknown as SQLiteDatabase;
      await migrateDatabase(sqlite);
      await seedSyncedRow(database, { archivedAt: '2026-08-29T10:00:00.000Z' });
      await sqlite.runAsync(
        `INSERT INTO pending_cloud_profile_removals
          (remote_id, parent_auth_user_id, mode, archived_at, requested_at)
         VALUES (?, ?, 'archive', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z')`,
        cloudProfile.id,
        parentId,
      );
      const repository = new SQLiteProfileSyncRepository(sqlite);

      // Cloud has not been told about the archive yet — its row is still "live".
      await repository.upsertCloud({ ...cloudProfile, archivedAt: null });

      const row = await readRow(database);
      expect(row?.archived_at).toBe('2026-08-29T10:00:00.000Z'); // still archived locally
    });

    it('never recreates a locally-deleted child while its removal is still pending in the outbox', async () => {
      const database = new NodeSQLiteDatabase();
      const sqlite = database as unknown as SQLiteDatabase;
      await migrateDatabase(sqlite);
      // delete() removed the local row entirely and queued the removal.
      await sqlite.runAsync(
        `INSERT INTO families (id, created_at, locale, timezone) VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
      );
      await sqlite.runAsync(
        `INSERT INTO pending_cloud_profile_removals
          (remote_id, parent_auth_user_id, mode, archived_at, requested_at)
         VALUES (?, ?, 'delete', NULL, '2026-08-29T10:00:00.000Z')`,
        cloudProfile.id,
        parentId,
      );
      const repository = new SQLiteProfileSyncRepository(sqlite);

      await repository.upsertCloud(cloudProfile);

      const row = await readRow(database);
      expect(row).toBeNull(); // never recreated
    });

    it('resumes normal recovery once the outbox for this child has already been cleared', async () => {
      const database = new NodeSQLiteDatabase();
      const sqlite = database as unknown as SQLiteDatabase;
      await migrateDatabase(sqlite);
      await seedSyncedRow(database, { archivedAt: '2026-08-29T10:00:00.000Z' });
      // No pending_cloud_profile_removals row — the outbox was already flushed.
      const repository = new SQLiteProfileSyncRepository(sqlite);

      await repository.upsertCloud({ ...cloudProfile, archivedAt: null });

      const row = await readRow(database);
      expect(row?.archived_at).toBeNull(); // cloud's un-archived state now applies
    });

    it('isolates 3 siblings with different sync states through the SAME recovery pass', async () => {
      const database = new NodeSQLiteDatabase();
      const sqlite = database as unknown as SQLiteDatabase;
      await migrateDatabase(sqlite);
      const childA = { ...cloudProfile, id: 'child-a', nickname: 'Cloud-A' };
      const childB = { ...cloudProfile, id: 'child-b', nickname: 'Cloud-B' };
      const childC = { ...cloudProfile, id: 'child-c', nickname: 'Cloud-C' };
      await sqlite.runAsync(
        `INSERT INTO families (id, created_at, locale, timezone) VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
      );
      const insertChild = (id: string, nickname: string, syncStatus: string, archivedAt: string | null) =>
        sqlite.runAsync(
          `INSERT INTO child_profiles
            (id, family_id, nickname, date_of_birth, age_band, avatar_id, created_at, archived_at,
             remote_id, parent_auth_user_id, sync_status, updated_at)
           VALUES (?, 'family-1', ?, '2017-03-15', '7_11', 'inci', '2026-08-01T00:00:00.000Z', ?, ?, ?, ?,
             '2026-08-29T09:00:00.000Z')`,
          id,
          nickname,
          archivedAt,
          id,
          parentId,
          syncStatus,
        );
      // A: pending local edit (must survive). B: clean, accepts cloud. C:
      // locally archived with a pending removal (must never resurrect).
      await insertChild('child-a', 'Local-A-Edit', 'pending', null);
      await insertChild('child-b', 'Local-B-Old', 'synced', null);
      await insertChild('child-c', 'Local-C', 'synced', '2026-08-29T10:00:00.000Z');
      await sqlite.runAsync(
        `INSERT INTO pending_cloud_profile_removals
          (remote_id, parent_auth_user_id, mode, archived_at, requested_at)
         VALUES ('child-c', ?, 'archive', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z')`,
        parentId,
      );
      const repository = new SQLiteProfileSyncRepository(sqlite);

      await repository.upsertCloud(childA);
      await repository.upsertCloud(childB);
      await repository.upsertCloud({ ...childC, archivedAt: null });

      const [rowA, rowB, rowC] = await Promise.all(
        ['child-a', 'child-b', 'child-c'].map((id) =>
          sqlite.getFirstAsync<{ nickname: string; archived_at: string | null; sync_status: string }>(
            'SELECT nickname, archived_at, sync_status FROM child_profiles WHERE id = ?',
            id,
          ),
        ),
      );
      expect(rowA).toEqual({ nickname: 'Local-A-Edit', archived_at: null, sync_status: 'pending' });
      expect(rowB).toEqual({ nickname: 'Cloud-B', archived_at: null, sync_status: 'synced' });
      expect(rowC).toEqual({
        nickname: 'Local-C',
        archived_at: '2026-08-29T10:00:00.000Z',
        sync_status: 'synced',
      });
    });
  });
});

describe('SQLiteProfileSyncRepository.reconcileCloudSnapshot', () => {
  async function seedProfile(
    sqlite: SQLiteDatabase,
    values: Readonly<{
      id: string;
      parentId?: string;
      remoteId?: string | null;
      syncStatus?: string;
    }>,
  ): Promise<void> {
    await sqlite.runAsync(
      `INSERT INTO child_profiles
        (id, family_id, nickname, age_band, avatar_id, created_at, archived_at,
         remote_id, parent_auth_user_id, sync_status, updated_at)
       VALUES (?, 'family-1', ?, '4_6', 'inci', '2026-09-01T00:00:00.000Z', NULL,
         ?, ?, ?, '2026-09-01T00:00:00.000Z')`,
      values.id,
      values.id.slice(0, 20),
      values.remoteId === undefined ? values.id : values.remoteId,
      values.parentId ?? parentId,
      values.syncStatus ?? 'synced',
    );
  }

  async function setup(): Promise<{ database: NodeSQLiteDatabase; sqlite: SQLiteDatabase }> {
    const database = new NodeSQLiteDatabase();
    const sqlite = database as unknown as SQLiteDatabase;
    await migrateDatabase(sqlite);
    await sqlite.runAsync(
      `INSERT INTO families (id, created_at, locale, timezone)
       VALUES ('family-1', '2026-09-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
    );
    return { database, sqlite };
  }

  it('archives only missing clean synced children for the current parent and clears a stale active selection', async () => {
    const { database, sqlite } = await setup();
    await seedProfile(sqlite, { id: 'cloud-present' });
    await seedProfile(sqlite, { id: 'cloud-missing' });
    await seedProfile(sqlite, { id: 'pending-local', syncStatus: 'pending' });
    await seedProfile(sqlite, { id: 'failed-local', syncStatus: 'failed' });
    await seedProfile(sqlite, { id: 'legacy-local', syncStatus: 'legacy_local' });
    await seedProfile(sqlite, { id: 'null-remote', remoteId: null });
    await seedProfile(sqlite, { id: 'other-parent', parentId: 'parent-2' });
    await seedProfile(sqlite, { id: 'pending-removal' });
    await sqlite.runAsync(
      `INSERT INTO pending_cloud_profile_removals
        (remote_id, parent_auth_user_id, mode, archived_at, requested_at)
       VALUES ('pending-removal', ?, 'delete', NULL, '2026-09-01T01:00:00.000Z')`,
      parentId,
    );
    await sqlite.runAsync(
      `INSERT INTO active_parent_profile(parent_auth_user_id, child_profile_id)
       VALUES (?, 'cloud-missing')`,
      parentId,
    );

    const repository = new SQLiteProfileSyncRepository(sqlite);
    await repository.reconcileCloudSnapshot(parentId, new Set(['cloud-present']));

    const rows = await sqlite.getAllAsync<{
      id: string;
      archived_at: string | null;
      sync_status: string;
    }>('SELECT id, archived_at, sync_status FROM child_profiles ORDER BY id');
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get('cloud-missing')?.archived_at).not.toBeNull();
    for (const preserved of [
      'cloud-present',
      'pending-local',
      'failed-local',
      'legacy-local',
      'null-remote',
      'other-parent',
      'pending-removal',
    ]) {
      expect(byId.get(preserved)?.archived_at).toBeNull();
    }
    await expect(
      sqlite.getFirstAsync(
        'SELECT child_profile_id FROM active_parent_profile WHERE parent_auth_user_id = ?',
        parentId,
      ),
    ).resolves.toBeNull();
    await expect(
      sqlite.getFirstAsync(
        'SELECT remote_id FROM pending_cloud_profile_removals WHERE remote_id = ?',
        'pending-removal',
      ),
    ).resolves.toEqual({ remote_id: 'pending-removal' });
    database.close();
  });

  it('hides a child deleted on one device when a second device successfully recovers, without touching valid siblings', async () => {
    const { database, sqlite } = await setup();
    await seedProfile(sqlite, { id: 'deleted-on-device-one' });
    await seedProfile(sqlite, { id: 'valid-sibling' });
    await sqlite.runAsync(
      `INSERT INTO active_parent_profile(parent_auth_user_id, child_profile_id)
       VALUES (?, 'deleted-on-device-one')`,
      parentId,
    );
    const validCloudProfile: CloudChildProfile = {
      ...cloudProfile,
      id: 'valid-sibling',
      parentId,
      nickname: 'Valid sibling',
    };
    const cloud: jest.Mocked<CloudChildProfileRepository> = {
      listOwned: jest.fn().mockResolvedValue([validCloudProfile]),
      upsert: jest.fn().mockImplementation((value) => Promise.resolve(value)),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    await new ProfileSyncUseCases(new SQLiteProfileSyncRepository(sqlite), cloud).recoverFromCloud(
      parentId,
    );

    const rows = await sqlite.getAllAsync<{ id: string; archived_at: string | null }>(
      `SELECT id, archived_at FROM child_profiles
       WHERE id IN ('deleted-on-device-one', 'valid-sibling') ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: 'deleted-on-device-one', archived_at: expect.any(String) },
      { id: 'valid-sibling', archived_at: null },
    ]);
    await expect(
      sqlite.getFirstAsync(
        'SELECT child_profile_id FROM active_parent_profile WHERE parent_auth_user_id = ?',
        parentId,
      ),
    ).resolves.toBeNull();
    database.close();
  });
});
