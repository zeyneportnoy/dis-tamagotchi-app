/**
 * Cloud sync contracts for the child's Mine Puan progress, brushing session
 * history and morning/evening slot evaluations.
 *
 * The CLOUD is authoritative for the absolute Mine score and streak. The client
 * never sends an absolute `current_mine_score` / `streak`: every change to those
 * columns is an atomic, idempotent, per-slot server operation
 * (`claimBrushingSlot` / `applySlotPenalty`) that returns the new authoritative
 * values. Local `profile_progress` is a cache — recovery/refresh PULL the cloud
 * value into it; nothing pushes it back as an absolute.
 */

export type CloudChildProgress = Readonly<{
  /** public.child_profiles.id of the owned child. */
  childId: string;
  currentMineScore: number;
  streak: number;
  /** Supabase `updated_at`; used to decide whether the cloud is newer. */
  updatedAt?: string;
}>;

/**
 * A completed morning/evening brushing slot presented to the server for its
 * one-and-only reward. Keyed by `(childId, localDayKey, period)` — the same
 * identity the backend's partial unique index guards — plus the stable
 * `sessionId` so retries are idempotent.
 */
export type BrushingSlotClaim = Readonly<{
  childId: string;
  sessionId: string;
  localDayKey: string;
  period: 'morning' | 'evening';
  startedAt: string;
  completedAt: string;
  timezoneOffsetMinutes: number;
}>;

/** A closed, unbrushed slot presented to the server for its one-and-only -10. */
export type SlotPenaltyClaim = Readonly<{
  childId: string;
  localDayKey: string;
  period: 'morning' | 'evening';
  evaluatedAt: string;
}>;

/**
 * The server's authoritative answer to a reward/penalty claim. `currentMineScore`
 * and `streak` are absolute values COMPUTED BY THE SERVER inside the same
 * transaction that (idempotently) claimed the slot — never a number the client
 * proposed.
 */
export type AuthoritativeProgress = Readonly<{
  childId: string;
  /** +20 on the first successful reward claim for this slot, else 0. */
  xpGranted: 0 | 20;
  /** -10 on the first successful penalty for this slot, else 0 (clamped by the floor). */
  penaltyApplied: number;
  /** Authoritative absolute Mine score AFTER this operation. */
  currentMineScore: number;
  /** Authoritative streak, recomputed from canonical full-day history. */
  streak: number;
  morningCompleted: boolean;
  eveningCompleted: boolean;
  /** True when this `(child, day, period)` had already been rewarded / penalised. */
  alreadyResolved: boolean;
  /** Supabase `updated_at` of the `child_progress` row after the operation. */
  updatedAt: string;
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
  /**
   * The ACTUAL Mine Puan removed at evaluation time, already clamped by the
   * score floor — distinct from `penaltyMine`, which is the fixed intended
   * label and does not reflect clamping (e.g. a -10 penalty against a score
   * of 5 only ever removes 5). Always 0 for a `completed` outcome. `null`
   * means this row predates this field (a legacy row from an older app
   * version): the real delta is unknown and must never be treated as -10 by
   * a repair pass — it hydrates as "no known loss".
   */
  appliedPenaltyMine: number | null;
  evaluatedAt: string;
  updatedAt?: string;
}>;

export interface CloudChildDataRepository {
  /**
   * Atomically claim the one reward for a completed morning/evening slot and
   * return the server-authoritative score/streak. Idempotent on
   * `(childId, localDayKey, period)` AND on `sessionId`: a second call — this
   * device retrying, or another device — grants +0 and returns the current
   * authoritative values. There is deliberately NO method to write an absolute
   * `current_mine_score` / `streak`.
   */
  claimBrushingSlot(claim: BrushingSlotClaim): Promise<AuthoritativeProgress>;
  /** Atomically apply the one -10 for a closed unbrushed slot. Idempotent per slot. */
  applySlotPenalty(claim: SlotPenaltyClaim): Promise<AuthoritativeProgress>;
  /** Append-only history rows that carry NO reward (interrupted / off-slot sessions). */
  upsertSession(session: CloudBrushingSession): Promise<string>;
  /** Append-only slot-evaluation history rows (the score effect goes via `applySlotPenalty`). */
  upsertSlotEvaluation(evaluation: CloudSlotEvaluation): Promise<string>;
  /** Current authoritative cloud row for one child (pull only). */
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

  readUnsyncedSessions(
    profileId: string,
  ): Promise<readonly Omit<CloudBrushingSession, 'childId'>[]>;
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
