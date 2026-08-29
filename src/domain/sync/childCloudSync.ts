/**
 * Cloud sync contracts for the child's Mine Puan progress, brushing session
 * history and morning/evening slot evaluations.
 *
 * Best-effort persistence + recovery only. The local SQLite domain transaction
 * stays the single source of truth for every reward/penalty calculation —
 * nothing here re-derives score, and hydration restores past results without
 * re-running reward/penalty business logic.
 */

export type CloudChildProgress = Readonly<{
  /** public.child_profiles.id of the owned child. */
  childId: string;
  currentMineScore: number;
  streak: number;
  /** Supabase `updated_at`; used to decide whether the cloud is newer. Push side leaves it undefined. */
  updatedAt?: string;
}>;

export type CloudBrushingPeriod = 'morning' | 'evening' | 'off_slot';
export type CloudBrushingSessionStatus = 'completed' | 'interrupted';

export type CloudBrushingSession = Readonly<{
  /** Stable local session UUID, reused across retries (upsert key). */
  id: string;
  childId: string;
  localDayKey: string;
  period: CloudBrushingPeriod;
  startedAt: string;
  completedAt: string;
  status: CloudBrushingSessionStatus;
  /** Mirrors the local reward: only ever 0 or 20. */
  rewardMine: 0 | 20;
  timezoneOffsetMinutes: number;
  updatedAt?: string;
}>;

export type CloudSlotEvaluation = Readonly<{
  childId: string;
  localDayKey: string;
  period: 'morning' | 'evening';
  outcome: 'completed' | 'missed';
  /** Mirrors the local penalty: only ever 0 or -10. */
  penaltyMine: 0 | -10;
  evaluatedAt: string;
  updatedAt?: string;
}>;

export interface CloudChildDataRepository {
  /** Returns the Supabase `updated_at` that was written. */
  upsertProgress(progress: CloudChildProgress): Promise<string>;
  upsertSession(session: CloudBrushingSession): Promise<string>;
  upsertSlotEvaluation(evaluation: CloudSlotEvaluation): Promise<string>;
  /** Current cloud row for one child (used to detect a concurrent write before pushing). */
  getProgress(childId: string): Promise<CloudChildProgress | null>;
  listOwnedProgress(): Promise<readonly CloudChildProgress[]>;
  listOwnedSessions(): Promise<readonly CloudBrushingSession[]>;
  listOwnedSlotEvaluations(): Promise<readonly CloudSlotEvaluation[]>;
}

export type LocalProgressSnapshot = Readonly<{
  currentMineScore: number;
  streak: number;
  syncedAt: string | null;
  syncedScore: number | null;
  syncedStreak: number | null;
}>;

export interface LocalChildCloudSyncRepository {
  /**
   * Remote `child_profiles.id` for a local profile, or `null` when the child
   * profile itself has not finished syncing yet (dependent data must wait).
   */
  resolveRemoteChildId(profileId: string): Promise<string | null>;
  /** Local profile ids whose child profile is already cloud-synced. */
  listSyncedProfileIds(): Promise<readonly string[]>;
  findProfileByRemoteChildId(remoteChildId: string): Promise<string | null>;

  readProgressSnapshot(profileId: string): Promise<LocalProgressSnapshot | null>;
  /** Insert or refresh the local progress row from a cloud value + stamp sync markers. */
  writeRecoveredProgress(profileId: string, progress: CloudChildProgress): Promise<void>;
  /** Record what was just pushed so future recoveries can compare timestamps. */
  markProgressSynced(
    profileId: string,
    score: number,
    streak: number,
    syncedAt: string,
  ): Promise<void>;

  readUnsyncedSessions(profileId: string): Promise<readonly Omit<CloudBrushingSession, 'childId'>[]>;
  markSessionSynced(sessionId: string, syncedAt: string): Promise<void>;
  hydrateSession(profileId: string, session: CloudBrushingSession): Promise<void>;

  readUnsyncedEvaluations(
    profileId: string,
  ): Promise<readonly Omit<CloudSlotEvaluation, 'childId'>[]>;
  markEvaluationSynced(
    profileId: string,
    localDayKey: string,
    period: 'morning' | 'evening',
    syncedAt: string,
  ): Promise<void>;
  hydrateSlotEvaluation(profileId: string, evaluation: CloudSlotEvaluation): Promise<void>;
}
