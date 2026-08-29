/**
 * Phase 2 cloud sync contracts for the child's Mine Puan progress, brushing
 * session history and morning/evening slot evaluations.
 *
 * These are best-effort persistence + recovery only. The local SQLite domain
 * transaction stays the single source of truth for every reward/penalty
 * calculation — nothing here re-derives score.
 */

export type CloudChildProgress = Readonly<{
  /** public.child_profiles.id of the owned child. */
  childId: string;
  currentMineScore: number;
  streak: number;
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
}>;

export type CloudSlotEvaluation = Readonly<{
  childId: string;
  localDayKey: string;
  period: 'morning' | 'evening';
  outcome: 'completed' | 'missed';
  /** Mirrors the local penalty: only ever 0 or -10. */
  penaltyMine: 0 | -10;
  evaluatedAt: string;
}>;

export interface CloudChildDataRepository {
  upsertProgress(progress: CloudChildProgress): Promise<void>;
  upsertSession(session: CloudBrushingSession): Promise<void>;
  upsertSlotEvaluation(evaluation: CloudSlotEvaluation): Promise<void>;
  listOwnedProgress(): Promise<readonly CloudChildProgress[]>;
}

export interface LocalChildCloudSyncRepository {
  /**
   * Remote `child_profiles.id` for a local profile, or `null` when the child
   * profile itself has not finished syncing yet (dependent data must wait).
   */
  resolveRemoteChildId(profileId: string): Promise<string | null>;
  readProgressForPush(
    profileId: string,
  ): Promise<{ currentMineScore: number; streak: number } | null>;
  readSessionForPush(
    profileId: string,
    sessionId: string,
  ): Promise<Omit<CloudBrushingSession, 'childId'> | null>;
  readRecentEvaluationsForPush(
    profileId: string,
    sinceDayKey: string,
  ): Promise<readonly Omit<CloudSlotEvaluation, 'childId'>[]>;
  /**
   * A local profile that maps to `remoteChildId` and has no `profile_progress`
   * row yet (safe to hydrate). Returns `null` when local data already exists —
   * local pending/newer values are never overwritten by an older cloud value.
   */
  findHydratableProfile(remoteChildId: string): Promise<string | null>;
  hydrateProgress(profileId: string, progress: CloudChildProgress): Promise<void>;
}
