import type { SQLiteDatabase } from 'expo-sqlite';

import { levelForXp } from '@/domain/rewards';
import type {
  CloudBrushingPeriod,
  CloudBrushingSession,
  CloudChildProgress,
  CloudSlotEvaluation,
  LocalChildCloudSyncRepository,
  LocalProgressSnapshot,
} from '@/domain/sync';

type ChildRow = {
  id: string;
  remote_id: string | null;
  sync_status: string;
};

type ProgressRow = {
  total_xp: number;
  current_streak: number;
  synced_at: string | null;
  synced_score: number | null;
  synced_streak: number | null;
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

const toLocalPeriod = (period: CloudBrushingPeriod): 'morning' | 'evening' | null =>
  period === 'off_slot' ? null : period;

/**
 * Local side of the multi-device sync. Sync markers (`synced_at` / `synced_score`
 * / `synced_streak` on `profile_progress`, `synced_at` on the append-only
 * history tables) let the sync layer tell "local has unpushed edits" from
 * "cloud is newer than this device". Hydration writes past results verbatim and
 * never re-runs reward/penalty logic.
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

  async listSyncedProfileIds(): Promise<readonly string[]> {
    const rows = await this.database.getAllAsync<{ id: string }>(
      `SELECT id FROM child_profiles
       WHERE sync_status = 'synced' AND remote_id IS NOT NULL AND archived_at IS NULL`,
    );
    return rows.map((row) => row.id);
  }

  async findProfileByRemoteChildId(remoteChildId: string): Promise<string | null> {
    const row = await this.database.getFirstAsync<{ id: string }>(
      `SELECT id FROM child_profiles
       WHERE (id = ? OR remote_id = ?) AND archived_at IS NULL LIMIT 1`,
      remoteChildId,
      remoteChildId,
    );
    return row?.id ?? null;
  }

  // ---- progress -----------------------------------------------------------

  async readProgressSnapshot(profileId: string): Promise<LocalProgressSnapshot | null> {
    const row = await this.database.getFirstAsync<ProgressRow>(
      `SELECT total_xp, current_streak, synced_at, synced_score, synced_streak
       FROM profile_progress WHERE child_profile_id = ?`,
      profileId,
    );
    if (!row) return null;
    return {
      currentMineScore: row.total_xp,
      streak: row.current_streak,
      syncedAt: row.synced_at,
      syncedScore: row.synced_score,
      syncedStreak: row.synced_streak,
    };
  }

  async writeRecoveredProgress(profileId: string, progress: CloudChildProgress): Promise<void> {
    const score = Math.max(0, progress.currentMineScore);
    const streak = Math.max(0, progress.streak);
    const syncedAt = progress.updatedAt ?? new Date().toISOString();
    const existing = await this.database.getFirstAsync<{ child_profile_id: string }>(
      `SELECT child_profile_id FROM profile_progress WHERE child_profile_id = ?`,
      profileId,
    );
    if (existing) {
      await this.database.runAsync(
        `UPDATE profile_progress
         SET total_xp = ?, current_streak = ?, level = ?,
             synced_at = ?, synced_score = ?, synced_streak = ?
         WHERE child_profile_id = ?`,
        score,
        streak,
        levelForXp(score),
        syncedAt,
        score,
        streak,
        profileId,
      );
      return;
    }
    await this.database.runAsync(
      `INSERT INTO profile_progress
        (child_profile_id, status_date, current_streak, total_xp, level,
         synced_at, synced_score, synced_streak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      profileId,
      progress.updatedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      streak,
      score,
      levelForXp(score),
      syncedAt,
      score,
      streak,
    );
  }

  async markProgressSynced(
    profileId: string,
    score: number,
    streak: number,
    syncedAt: string,
  ): Promise<void> {
    await this.database.runAsync(
      `UPDATE profile_progress
       SET synced_at = ?, synced_score = ?, synced_streak = ?
       WHERE child_profile_id = ?`,
      syncedAt,
      score,
      streak,
      profileId,
    );
  }

  // ---- brushing sessions ------------------------------------------------

  async readUnsyncedSessions(
    profileId: string,
  ): Promise<readonly Omit<CloudBrushingSession, 'childId'>[]> {
    const rows = await this.database.getAllAsync<SessionRow>(
      `SELECT id, started_at, completed_at, completed, period, local_day_key, xp_granted
       FROM brushing_sessions
       WHERE profile_id = ? AND synced_at IS NULL AND local_day_key IS NOT NULL
       ORDER BY completed_at`,
      profileId,
    );
    return rows.map((row) => ({
      id: row.id,
      localDayKey: row.local_day_key as string,
      period: toCloudPeriod(row.period),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.completed === 1 ? 'completed' : 'interrupted',
      rewardMine: row.xp_granted === 20 ? 20 : 0,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    }));
  }

  async markSessionSynced(sessionId: string, syncedAt: string): Promise<void> {
    await this.database.runAsync(
      `UPDATE brushing_sessions SET synced_at = ? WHERE id = ?`,
      syncedAt,
      sessionId,
    );
  }

  async hydrateSession(profileId: string, session: CloudBrushingSession): Promise<void> {
    const completed = session.status === 'completed' ? 1 : 0;
    const period = toLocalPeriod(session.period);
    // INSERT OR IGNORE on the stable id → a session already present locally is
    // never overwritten and never inserted twice. reward_granted_at is set so
    // the row is treated as already-processed history, not a fresh session.
    await this.database.runAsync(
      `INSERT OR IGNORE INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period, created_at,
         local_day_key, reward_granted_at, xp_granted, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      profileId,
      session.startedAt,
      session.completedAt,
      completed === 1 ? 120 : 0,
      completed,
      period,
      session.completedAt,
      session.localDayKey,
      completed === 1 ? session.completedAt : null,
      session.rewardMine,
      session.updatedAt ?? new Date().toISOString(),
    );
  }

  // ---- slot evaluations -----------------------------------------------

  async readUnsyncedEvaluations(
    profileId: string,
  ): Promise<readonly Omit<CloudSlotEvaluation, 'childId'>[]> {
    const rows = await this.database.getAllAsync<EvaluationRow>(
      `SELECT local_day_key, period, outcome, penalty_amount, evaluated_at
       FROM brushing_slot_evaluations
       WHERE child_profile_id = ? AND synced_at IS NULL
       ORDER BY local_day_key, period`,
      profileId,
    );
    return rows.map((row) => ({
      localDayKey: row.local_day_key,
      period: row.period,
      outcome: row.outcome,
      penaltyMine: row.penalty_amount === -10 ? -10 : 0,
      evaluatedAt: row.evaluated_at,
    }));
  }

  async markEvaluationSynced(
    profileId: string,
    localDayKey: string,
    period: 'morning' | 'evening',
    syncedAt: string,
  ): Promise<void> {
    await this.database.runAsync(
      `UPDATE brushing_slot_evaluations SET synced_at = ?
       WHERE child_profile_id = ? AND local_day_key = ? AND period = ?`,
      syncedAt,
      profileId,
      localDayKey,
      period,
    );
  }

  async hydrateSlotEvaluation(profileId: string, evaluation: CloudSlotEvaluation): Promise<void> {
    // INSERT OR IGNORE on the composite key → an evaluation already present is
    // never overwritten. reconcileMissedSlots checks for this same row before
    // applying a penalty, so hydrating it here makes recovery penalty-safe.
    await this.database.runAsync(
      `INSERT OR IGNORE INTO brushing_slot_evaluations
        (child_profile_id, local_day_key, period, outcome, penalty_amount,
         score_before, score_after, evaluated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      profileId,
      evaluation.localDayKey,
      evaluation.period,
      evaluation.outcome,
      evaluation.penaltyMine === -10 ? -10 : 0,
      evaluation.evaluatedAt,
      evaluation.updatedAt ?? new Date().toISOString(),
    );
  }
}
