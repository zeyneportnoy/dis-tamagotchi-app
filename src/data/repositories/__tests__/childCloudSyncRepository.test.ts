import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteChildCloudSyncRepository } from '../SQLiteChildCloudSyncRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-0000000000fb') }));
jest.mock('expo-sqlite', () => ({}));

const asDb = (database: NodeSQLiteDatabase): SQLiteDatabase => database as unknown as SQLiteDatabase;

async function seedSyncedChild(
  database: NodeSQLiteDatabase,
  profileId: string,
  overrides: { syncStatus?: string; remoteId?: string | null } = {},
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO families (id, created_at, locale, timezone)
     VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
  );
  await database.runAsync(
    `INSERT INTO child_profiles
      (id, family_id, nickname, age_band, avatar_id, created_at, remote_id, parent_auth_user_id,
       sync_status, updated_at)
     VALUES (?, 'family-1', ?, '4_6', 'inci', '2026-08-01T00:00:00.000Z', ?, 'parent-1', ?, ?)`,
    profileId,
    profileId,
    overrides.remoteId === undefined ? profileId : overrides.remoteId,
    overrides.syncStatus ?? 'synced',
    '2026-08-01T00:00:00.000Z',
  );
}

async function seedProgress(
  database: NodeSQLiteDatabase,
  profileId: string,
  totalXp: number,
  streak: number,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO profile_progress (child_profile_id, status_date, current_streak, total_xp, level)
     VALUES (?, '2026-08-29', ?, ?, 1)`,
    profileId,
    streak,
    totalXp,
  );
}

const build = async (): Promise<{ db: NodeSQLiteDatabase; repo: SQLiteChildCloudSyncRepository }> => {
  const db = new NodeSQLiteDatabase();
  await migrateDatabase(asDb(db));
  return { db, repo: new SQLiteChildCloudSyncRepository(asDb(db)) };
};

describe('SQLiteChildCloudSyncRepository', () => {
  describe('resolveRemoteChildId', () => {
    it('returns the remote id only when the child profile is synced', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await expect(repo.resolveRemoteChildId('profile-1')).resolves.toBe('profile-1');
    });

    it('returns null while the child profile is still pending', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1', { syncStatus: 'pending', remoteId: null });
      await expect(repo.resolveRemoteChildId('profile-1')).resolves.toBeNull();
    });
  });

  describe('readProgressForPush', () => {
    it('maps total_xp and current_streak', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await seedProgress(db, 'profile-1', 240, 3);
      await expect(repo.readProgressForPush('profile-1')).resolves.toEqual({
        currentMineScore: 240,
        streak: 3,
      });
    });

    it('returns null when there is no local progress row', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await expect(repo.readProgressForPush('profile-1')).resolves.toBeNull();
    });
  });

  describe('readSessionForPush', () => {
    const insertSession = (
      db: NodeSQLiteDatabase,
      row: {
        id: string;
        period: 'morning' | 'evening' | null;
        completed: 0 | 1;
        xpGranted: number;
        localDayKey?: string | null;
      },
    ) =>
      db.runAsync(
        `INSERT INTO brushing_sessions
          (id, profile_id, started_at, completed_at, duration_seconds, completed, period, created_at,
           local_day_key, xp_granted)
         VALUES (?, 'profile-1', '2026-08-29T06:00:00.000Z', '2026-08-29T06:02:00.000Z', 120, ?, ?,
           '2026-08-29T06:02:00.000Z', ?, ?)`,
        row.id,
        row.completed,
        row.period,
        row.localDayKey === undefined ? '2026-08-29' : row.localDayKey,
        row.xpGranted,
      );

    it('maps a rewarded morning session (reward_mine = 20)', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await insertSession(db, { id: 's1', period: 'morning', completed: 1, xpGranted: 20 });
      await expect(repo.readSessionForPush('profile-1', 's1')).resolves.toMatchObject({
        id: 's1',
        localDayKey: '2026-08-29',
        period: 'morning',
        status: 'completed',
        rewardMine: 20,
      });
    });

    it('maps a same-slot repeat session (reward_mine = 0, kept in history)', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await insertSession(db, { id: 's2', period: 'morning', completed: 1, xpGranted: 0 });
      await expect(repo.readSessionForPush('profile-1', 's2')).resolves.toMatchObject({
        rewardMine: 0,
        status: 'completed',
      });
    });

    it('maps an off-slot session to period off_slot with reward_mine 0', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await insertSession(db, { id: 's3', period: null, completed: 1, xpGranted: 0 });
      await expect(repo.readSessionForPush('profile-1', 's3')).resolves.toMatchObject({
        period: 'off_slot',
        rewardMine: 0,
      });
    });

    it('maps an interrupted session to status interrupted', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await insertSession(db, { id: 's4', period: 'evening', completed: 0, xpGranted: 0 });
      await expect(repo.readSessionForPush('profile-1', 's4')).resolves.toMatchObject({
        status: 'interrupted',
      });
    });
  });

  describe('readRecentEvaluationsForPush', () => {
    const insertEvaluation = (
      db: NodeSQLiteDatabase,
      dayKey: string,
      period: 'morning' | 'evening',
      outcome: 'completed' | 'missed',
      penalty: -10 | 0,
    ) =>
      db.runAsync(
        `INSERT INTO brushing_slot_evaluations
          (child_profile_id, local_day_key, period, outcome, penalty_amount, score_before,
           score_after, evaluated_at)
         VALUES ('profile-1', ?, ?, ?, ?, 100, ?, '2026-08-29T12:00:00.000Z')`,
        dayKey,
        period,
        outcome,
        penalty,
        penalty === -10 ? 90 : 100,
      );

    it('maps missed evaluations to penalty_mine -10 and filters by sinceDayKey', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await insertEvaluation(db, '2026-08-01', 'morning', 'missed', -10);
      await insertEvaluation(db, '2026-08-29', 'morning', 'missed', -10);
      await insertEvaluation(db, '2026-08-29', 'evening', 'completed', 0);

      const evals = await repo.readRecentEvaluationsForPush('profile-1', '2026-08-15');
      // The pre-2026-08-15 row is filtered out; order between same-day slots is
      // irrelevant for an idempotent upsert.
      expect(evals).toHaveLength(2);
      expect(evals).toEqual(
        expect.arrayContaining([
          {
            localDayKey: '2026-08-29',
            period: 'morning',
            outcome: 'missed',
            penaltyMine: -10,
            evaluatedAt: '2026-08-29T12:00:00.000Z',
          },
          {
            localDayKey: '2026-08-29',
            period: 'evening',
            outcome: 'completed',
            penaltyMine: 0,
            evaluatedAt: '2026-08-29T12:00:00.000Z',
          },
        ]),
      );
    });
  });

  describe('recovery hydration', () => {
    it('finds a profile with no progress row and hydrates it once', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');

      await expect(repo.findHydratableProfile('profile-1')).resolves.toBe('profile-1');

      await repo.hydrateProgress('profile-1', {
        childId: 'profile-1',
        currentMineScore: 240,
        streak: 4,
      });
      await expect(
        asDb(db).getFirstAsync<{ total_xp: number; current_streak: number; level: number }>(
          `SELECT total_xp, current_streak, level FROM profile_progress WHERE child_profile_id = 'profile-1'`,
        ),
      ).resolves.toEqual({ total_xp: 240, current_streak: 4, level: 1 });

      // Now that local data exists, it is no longer hydratable and never overwritten.
      await expect(repo.findHydratableProfile('profile-1')).resolves.toBeNull();
      await repo.hydrateProgress('profile-1', {
        childId: 'profile-1',
        currentMineScore: 10,
        streak: 0,
      });
      await expect(
        asDb(db).getFirstAsync<{ total_xp: number }>(
          `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
        ),
      ).resolves.toEqual({ total_xp: 240 });
    });
  });
});
