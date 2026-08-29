import type { SQLiteDatabase } from 'expo-sqlite';

import { toLocalDateKey } from '@/domain/brushing';
import { levelForXp } from '@/domain/rewards';
import type {
  CloudBrushingPeriod,
  CloudBrushingSession,
  CloudChildProgress,
  CloudSlotEvaluation,
  LocalChildCloudSyncRepository,
} from '@/domain/sync';

type ChildRow = {
  id: string;
  remote_id: string | null;
  sync_status: string;
};

type ProgressRow = {
  total_xp: number;
  current_streak: number;
};

type SessionRow = {
  id: string;
  started_at: string;
  completed_at: string;
  completed: number;
  period: 'morning' | 'evening' | null;
  local_day_key: string | null;
  xp_granted: number;
};

type EvaluationRow = {
  local_day_key: string;
  period: 'morning' | 'evening';
  outcome: 'completed' | 'missed';
  penalty_amount: -10 | 0;
  evaluated_at: string;
};

const toCloudPeriod = (period: 'morning' | 'evening' | null): CloudBrushingPeriod =>
  period ?? 'off_slot';

/**
 * Reads local rows for cloud push and hydrates cloud progress back into local
 * SQLite — only when local has nothing yet, so a pending/newer local value is
 * never clobbered by an older cloud one.
 */
export class SQLiteChildCloudSyncRepository implements LocalChildCloudSyncRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async resolveRemoteChildId(profileId: string): Promise<string | null> {
    const row = await this.database.getFirstAsync<ChildRow>(
      `SELECT id, remote_id, sync_status FROM child_profiles
       WHERE id = ? AND archived_at IS NULL`,
      profileId,
    );
    if (!row || row.sync_status !== 'synced') return null;
    return row.remote_id ?? null;
  }

  async readProgressForPush(
    profileId: string,
  ): Promise<{ currentMineScore: number; streak: number } | null> {
    const row = await this.database.getFirstAsync<ProgressRow>(
      `SELECT total_xp, current_streak FROM profile_progress WHERE child_profile_id = ?`,
      profileId,
    );
    if (!row) return null;
    return { currentMineScore: row.total_xp, streak: row.current_streak };
  }

  async readSessionForPush(
    profileId: string,
    sessionId: string,
  ): Promise<Omit<CloudBrushingSession, 'childId'> | null> {
    const row = await this.database.getFirstAsync<SessionRow>(
      `SELECT id, started_at, completed_at, completed, period, local_day_key, xp_granted
       FROM brushing_sessions WHERE id = ? AND profile_id = ?`,
      sessionId,
      profileId,
    );
    if (!row || !row.local_day_key) return null;
    return {
      id: row.id,
      localDayKey: row.local_day_key,
      period: toCloudPeriod(row.period),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.completed === 1 ? 'completed' : 'interrupted',
      rewardMine: row.xp_granted === 20 ? 20 : 0,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    };
  }

  async readRecentEvaluationsForPush(
    profileId: string,
    sinceDayKey: string,
  ): Promise<readonly Omit<CloudSlotEvaluation, 'childId'>[]> {
    const rows = await this.database.getAllAsync<EvaluationRow>(
      `SELECT local_day_key, period, outcome, penalty_amount, evaluated_at
       FROM brushing_slot_evaluations
       WHERE child_profile_id = ? AND local_day_key >= ?
       ORDER BY local_day_key, period`,
      profileId,
      sinceDayKey,
    );
    return rows.map((row) => ({
      localDayKey: row.local_day_key,
      period: row.period,
      outcome: row.outcome,
      penaltyMine: row.penalty_amount === -10 ? -10 : 0,
      evaluatedAt: row.evaluated_at,
    }));
  }

  async findHydratableProfile(remoteChildId: string): Promise<string | null> {
    const row = await this.database.getFirstAsync<{ id: string }>(
      `SELECT cp.id FROM child_profiles cp
       LEFT JOIN profile_progress pp ON pp.child_profile_id = cp.id
       WHERE (cp.id = ? OR cp.remote_id = ?)
         AND cp.archived_at IS NULL
         AND pp.child_profile_id IS NULL
       LIMIT 1`,
      remoteChildId,
      remoteChildId,
    );
    return row?.id ?? null;
  }

  async hydrateProgress(profileId: string, progress: CloudChildProgress): Promise<void> {
    // INSERT OR IGNORE: if a local row appeared in the meantime, local wins.
    await this.database.runAsync(
      `INSERT OR IGNORE INTO profile_progress
        (child_profile_id, status_date, current_streak, total_xp, level)
       VALUES (?, ?, ?, ?, ?)`,
      profileId,
      toLocalDateKey(new Date()),
      Math.max(0, progress.streak),
      Math.max(0, progress.currentMineScore),
      levelForXp(Math.max(0, progress.currentMineScore)),
    );
  }
}
