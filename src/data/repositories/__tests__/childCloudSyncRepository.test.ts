import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import type { CloudBrushingSession, CloudChildProgress, CloudSlotEvaluation } from '@/domain/sync';
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

const build = async (): Promise<{ db: NodeSQLiteDatabase; repo: SQLiteChildCloudSyncRepository }> => {
  const db = new NodeSQLiteDatabase();
  await migrateDatabase(asDb(db));
  return { db, repo: new SQLiteChildCloudSyncRepository(asDb(db)) };
};

describe('SQLiteChildCloudSyncRepository', () => {
  describe('resolveRemoteChildId / listSyncedProfileIds', () => {
    it('returns the remote id only for synced children', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await seedSyncedChild(db, 'profile-2', { syncStatus: 'pending', remoteId: null });
      await expect(repo.resolveRemoteChildId('profile-1')).resolves.toBe('profile-1');
      await expect(repo.resolveRemoteChildId('profile-2')).resolves.toBeNull();
      await expect(repo.listSyncedProfileIds()).resolves.toEqual(['profile-1']);
    });
  });

  describe('progress snapshot + sync markers', () => {
    it('reports dirty state via the last-synced snapshot columns', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await db.runAsync(
        `INSERT INTO profile_progress (child_profile_id, status_date, current_streak, total_xp, level)
         VALUES ('profile-1', '2026-08-29', 3, 240, 1)`,
      );

      // Never synced yet.
      await expect(repo.readProgressSnapshot('profile-1')).resolves.toMatchObject({
        currentMineScore: 240,
        streak: 3,
        syncedAt: null,
        syncedScore: null,
        syncedStreak: null,
      });

      await repo.markProgressSynced('profile-1', 240, 3, '2026-08-29T10:00:00.000Z');
      await expect(repo.readProgressSnapshot('profile-1')).resolves.toMatchObject({
        syncedAt: '2026-08-29T10:00:00.000Z',
        syncedScore: 240,
        syncedStreak: 3,
      });
    });

    it('writeRecoveredProgress inserts and later refreshes, stamping markers to the cloud value', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      const row: CloudChildProgress = {
        childId: 'profile-1',
        currentMineScore: 640,
        streak: 5,
        updatedAt: '2026-08-25T00:00:00.000Z',
      };
      await repo.writeRecoveredProgress('profile-1', row);
      await expect(
        asDb(db).getFirstAsync<{ total_xp: number; current_streak: number; synced_score: number }>(
          `SELECT total_xp, current_streak, synced_score FROM profile_progress WHERE child_profile_id = 'profile-1'`,
        ),
      ).resolves.toEqual({ total_xp: 640, current_streak: 5, synced_score: 640 });

      await repo.writeRecoveredProgress('profile-1', { ...row, currentMineScore: 720, streak: 6 });
      await expect(
        asDb(db).getFirstAsync<{ total_xp: number }>(
          `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
        ),
      ).resolves.toEqual({ total_xp: 720 });
    });
  });

  describe('brushing session history', () => {
    const cloudSession = (over: Partial<CloudBrushingSession> = {}): CloudBrushingSession => ({
      id: 'sess-1',
      childId: 'profile-1',
      localDayKey: '2026-08-24',
      period: 'morning',
      startedAt: '2026-08-24T06:00:00.000Z',
      completedAt: '2026-08-24T06:02:00.000Z',
      status: 'completed',
      rewardMine: 20,
      timezoneOffsetMinutes: -180,
      updatedAt: '2026-08-24T06:02:01.000Z',
      ...over,
    });

    it('hydrates a session once and never duplicates it on repeated recovery', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await repo.hydrateSession('profile-1', cloudSession());
      await repo.hydrateSession('profile-1', cloudSession({ status: 'interrupted' }));

      const rows = await asDb(db).getAllAsync<{ id: string; period: string; completed: number; synced_at: string }>(
        `SELECT id, period, completed, synced_at FROM brushing_sessions WHERE profile_id = 'profile-1'`,
      );
      expect(rows).toEqual([
        {
          id: 'sess-1',
          period: 'morning',
          completed: 1,
          synced_at: '2026-08-24T06:02:01.000Z',
        },
      ]);
    });

    it('maps an off-slot period to NULL and leaves it out of the unsynced push set', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await repo.hydrateSession('profile-1', cloudSession({ id: 'off-1', period: 'off_slot' }));
      const stored = await asDb(db).getFirstAsync<{ period: string | null }>(
        `SELECT period FROM brushing_sessions WHERE id = 'off-1'`,
      );
      expect(stored?.period).toBeNull();
      // Hydrated rows already carry synced_at, so they are not re-pushed.
      await expect(repo.readUnsyncedSessions('profile-1')).resolves.toEqual([]);
    });

    it('readUnsyncedSessions returns only rows with no synced_at, and marking clears them', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await db.runAsync(
        `INSERT INTO brushing_sessions
          (id, profile_id, started_at, completed_at, duration_seconds, completed, period, created_at,
           local_day_key, xp_granted)
         VALUES ('local-1', 'profile-1', '2026-08-29T06:00:00.000Z', '2026-08-29T06:02:00.000Z',
           120, 1, 'morning', '2026-08-29T06:02:00.000Z', '2026-08-29', 20)`,
      );
      await expect(repo.readUnsyncedSessions('profile-1')).resolves.toEqual([
        expect.objectContaining({ id: 'local-1', rewardMine: 20, status: 'completed', period: 'morning' }),
      ]);
      await repo.markSessionSynced('local-1', '2026-08-29T07:00:00.000Z');
      await expect(repo.readUnsyncedSessions('profile-1')).resolves.toEqual([]);
    });
  });

  describe('slot evaluation history', () => {
    const cloudEval = (over: Partial<CloudSlotEvaluation> = {}): CloudSlotEvaluation => ({
      childId: 'profile-1',
      localDayKey: '2026-08-23',
      period: 'morning',
      outcome: 'missed',
      penaltyMine: -10,
      evaluatedAt: '2026-08-24T00:00:00.000Z',
      updatedAt: '2026-08-24T00:00:01.000Z',
      ...over,
    });

    it('hydrates on the composite key once and never re-inserts', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await repo.hydrateSlotEvaluation('profile-1', cloudEval());
      await repo.hydrateSlotEvaluation('profile-1', cloudEval({ outcome: 'completed', penaltyMine: 0 }));

      const rows = await asDb(db).getAllAsync<{
        outcome: string;
        penalty_amount: number;
        synced_at: string;
      }>(
        `SELECT outcome, penalty_amount, synced_at FROM brushing_slot_evaluations
         WHERE child_profile_id = 'profile-1' AND local_day_key = '2026-08-23' AND period = 'morning'`,
      );
      expect(rows).toEqual([
        { outcome: 'missed', penalty_amount: -10, synced_at: '2026-08-24T00:00:01.000Z' },
      ]);
    });

    it('a hydrated missed evaluation is NOT re-pushed and blocks a second -10', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      await db.runAsync(
        `INSERT INTO profile_progress (child_profile_id, status_date, total_xp) VALUES ('profile-1', '2026-08-29', 640)`,
      );
      await repo.hydrateSlotEvaluation('profile-1', cloudEval());

      // Not in the unsynced push set (already carries synced_at).
      await expect(repo.readUnsyncedEvaluations('profile-1')).resolves.toEqual([]);

      // Score is untouched by hydration — no penalty was applied here.
      await expect(
        asDb(db).getFirstAsync<{ total_xp: number }>(
          `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
        ),
      ).resolves.toEqual({ total_xp: 640 });
    });

    it('readUnsyncedEvaluations returns locally-created rows regardless of age; marking clears them', async () => {
      const { db, repo } = await build();
      await seedSyncedChild(db, 'profile-1');
      // 40 days old — the old 14-day window would have dropped this.
      await db.runAsync(
        `INSERT INTO brushing_slot_evaluations
          (child_profile_id, local_day_key, period, outcome, penalty_amount, score_before, score_after, evaluated_at)
         VALUES ('profile-1', '2026-07-20', 'evening', 'missed', -10, 100, 90, '2026-07-20T20:00:00.000Z')`,
      );
      await expect(repo.readUnsyncedEvaluations('profile-1')).resolves.toEqual([
        {
          localDayKey: '2026-07-20',
          period: 'evening',
          outcome: 'missed',
          penaltyMine: -10,
          evaluatedAt: '2026-07-20T20:00:00.000Z',
        },
      ]);
      await repo.markEvaluationSynced('profile-1', '2026-07-20', 'evening', '2026-08-29T00:00:00.000Z');
      await expect(repo.readUnsyncedEvaluations('profile-1')).resolves.toEqual([]);
    });
  });
});
