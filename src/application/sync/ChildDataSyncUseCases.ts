import type {
  AuthoritativeProgress,
  CloudChildDataRepository,
  CloudChildProgress,
  LocalChildCloudSyncRepository,
} from '@/domain/sync';

/**
 * Orchestrates multi-device cloud sync for a child's Mine Puan progress,
 * brushing-session history and slot evaluations.
 *
 * Authority model (this is the fix for the "a stale device zeroed every child's
 * cloud score" incident):
 *
 *  - The CLOUD owns the absolute `current_mine_score` / `streak`. This class
 *    NEVER sends an absolute score. A completed slot is claimed with
 *    `cloud.claimBrushingSlot(...)` and a missed slot with
 *    `cloud.applySlotPenalty(...)`; both are atomic + idempotent per
 *    `(child, local day, period)` and RETURN the new authoritative values,
 *    which are written straight into the local cache.
 *  - Recovery/refresh is PULL ONLY: `recoverProgress()` copies the cloud row
 *    into local `profile_progress` unconditionally — local can never "win" by
 *    being newer, dirty, defaulted or unhydrated.
 */
export class ChildDataSyncUseCases {
  constructor(
    private readonly local: LocalChildCloudSyncRepository,
    private readonly cloud: CloudChildDataRepository,
  ) {}

  private toCloudProgress(authoritative: AuthoritativeProgress): CloudChildProgress {
    return {
      childId: authoritative.childId,
      currentMineScore: authoritative.currentMineScore,
      streak: authoritative.streak,
      updatedAt: authoritative.updatedAt,
    };
  }

  /**
   * Flush this child's unsynced completed/interrupted brushing sessions.
   * Completed morning/evening slots go through the atomic reward claim; the
   * authoritative score/streak it returns replaces the local optimistic cache.
   * Interrupted / off-slot rows are plain append-only history (no reward).
   *
   * Returns the authoritative result keyed by session id for every slot it
   * actually claimed, so a caller (the completion screen) can render the
   * server's verdict instead of the local optimistic guess.
   */
  async pushUnsyncedSessions(
    profileId: string,
  ): Promise<ReadonlyMap<string, AuthoritativeProgress>> {
    const claims = new Map<string, AuthoritativeProgress>();
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return claims;
    for (const session of await this.local.readUnsyncedSessions(profileId)) {
      // Only a slot this device believes it completed FIRST (local optimistic
      // +20) is presented for a reward claim; the server arbitrates and grants
      // +0 if another device already claimed it. Everything else — interrupted,
      // off-slot, or a local duplicate re-brush (rewardMine 0) — is plain
      // append-only history.
      if (
        session.status === 'completed' &&
        session.period !== 'off_slot' &&
        session.rewardMine === 20
      ) {
        const authoritative = await this.cloud.claimBrushingSlot({
          childId,
          sessionId: session.id,
          localDayKey: session.localDayKey,
          period: session.period,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          timezoneOffsetMinutes: session.timezoneOffsetMinutes,
        });
        await this.local.writeRecoveredProgress(profileId, this.toCloudProgress(authoritative));
        await this.local.markSessionSynced(session.id, authoritative.updatedAt);
        claims.set(session.id, authoritative);
        continue;
      }
      const updatedAt = await this.cloud.upsertSession({ ...session, childId });
      await this.local.markSessionSynced(session.id, updatedAt);
    }
    return claims;
  }

  /**
   * Flush this child's unsynced slot evaluations. A `missed` evaluation goes
   * through the atomic penalty; `completed` evaluations are recorded as plain
   * history (their score effect, if any, was the reward path).
   */
  async pushUnsyncedEvaluations(profileId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    for (const evaluation of await this.local.readUnsyncedEvaluations(profileId)) {
      if (evaluation.outcome === 'missed') {
        const authoritative = await this.cloud.applySlotPenalty({
          childId,
          localDayKey: evaluation.localDayKey,
          period: evaluation.period,
          evaluatedAt: evaluation.evaluatedAt,
        });
        await this.local.writeRecoveredProgress(profileId, this.toCloudProgress(authoritative));
        await this.local.markEvaluationSynced(
          profileId,
          evaluation.localDayKey,
          evaluation.period,
          authoritative.updatedAt,
        );
        continue;
      }
      const updatedAt = await this.cloud.upsertSlotEvaluation({ ...evaluation, childId });
      await this.local.markEvaluationSynced(
        profileId,
        evaluation.localDayKey,
        evaluation.period,
        updatedAt,
      );
    }
  }

  /**
   * Flush every locally pending write for one child (post-write / retry path).
   * Returns the authoritative reward result per claimed session id.
   */
  async pushChild(profileId: string): Promise<ReadonlyMap<string, AuthoritativeProgress>> {
    if (!(await this.local.resolveRemoteChildId(profileId))) {
      return new Map();
    }
    const claims = await this.pushUnsyncedSessions(profileId);
    await this.pushUnsyncedEvaluations(profileId);
    return claims;
  }

  /** Retry path: flush every synced child's pending writes. */
  async pushAllPending(): Promise<void> {
    for (const profileId of await this.local.listSyncedProfileIds()) {
      await this.pushChild(profileId);
    }
  }

  /**
   * Pull authoritative Mine Puan progress for every owned child into the local
   * cache. The cloud row ALWAYS wins: a local row that is newer, dirty,
   * defaulted to 0 or never hydrated is overwritten, so a stale device can
   * never keep — let alone propagate — a wrong score. A child with a pending
   * unclaimed reward has no cloud row yet; that child is simply skipped here
   * and its claim creates the row on the next `pushChild`.
   */
  async recoverProgress(): Promise<void> {
    for (const row of await this.cloud.listOwnedProgress()) {
      const profileId = await this.local.findProfileByRemoteChildId(row.childId);
      if (!profileId) continue;
      await this.local.writeRecoveredProgress(profileId, row);
    }
  }

  /**
   * Fresh-install recovery of brushing session + slot evaluation history.
   * Idempotent INSERT OR IGNORE on the stable id / composite key — repeated
   * recovery never duplicates a row and never re-applies a reward or penalty.
   */
  async recoverBrushingHistory(): Promise<void> {
    for (const session of await this.cloud.listOwnedSessions()) {
      const profileId = await this.local.findProfileByRemoteChildId(session.childId);
      if (!profileId) continue;
      await this.local.hydrateSession(profileId, session);
    }
    for (const evaluation of await this.cloud.listOwnedSlotEvaluations()) {
      const profileId = await this.local.findProfileByRemoteChildId(evaluation.childId);
      if (!profileId) continue;
      await this.local.hydrateSlotEvaluation(profileId, evaluation);
    }
  }
}

export type { CloudChildProgress };
