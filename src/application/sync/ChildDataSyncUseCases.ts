import type {
  CloudChildDataRepository,
  CloudChildProgress,
  LocalChildCloudSyncRepository,
  LocalProgressSnapshot,
} from '@/domain/sync';

/**
 * Orchestrates multi-device cloud sync for a child's Mine Puan progress,
 * brushing session history and slot evaluations. It never computes score — the
 * local SQLite transaction has already produced the truth, and hydration only
 * restores past results (no reward/penalty re-run).
 *
 * Conflict rule (deterministic):
 *  - local has unpushed edits (current values != last-synced snapshot) → keep
 *    local, push it to the cloud; never let an older cloud value overwrite it.
 *  - local is clean and the cloud row is newer than this device's last sync →
 *    hydrate the cloud value into local.
 *  - already equal → do nothing.
 */
export class ChildDataSyncUseCases {
  constructor(
    private readonly local: LocalChildCloudSyncRepository,
    private readonly cloud: CloudChildDataRepository,
  ) {}

  private static isProgressDirty(snapshot: LocalProgressSnapshot): boolean {
    return (
      snapshot.syncedScore === null ||
      snapshot.syncedStreak === null ||
      snapshot.currentMineScore !== snapshot.syncedScore ||
      snapshot.streak !== snapshot.syncedStreak
    );
  }

  async pushProgress(profileId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    const snapshot = await this.local.readProgressSnapshot(profileId);
    if (!snapshot) return;

    // Concurrent-write guard: if the cloud row advanced past this device's last
    // sync (another device wrote), do NOT blind-overwrite it with our possibly
    // stale value. recoverProgress() (bootstrap / foreground) merges instead.
    const cloudRow = await this.cloud.getProgress(childId);
    if (
      cloudRow &&
      cloudRow.updatedAt &&
      snapshot.syncedAt &&
      cloudRow.updatedAt > snapshot.syncedAt &&
      (cloudRow.currentMineScore !== snapshot.syncedScore ||
        cloudRow.streak !== snapshot.syncedStreak)
    ) {
      return;
    }

    const updatedAt = await this.cloud.upsertProgress({
      childId,
      currentMineScore: snapshot.currentMineScore,
      streak: snapshot.streak,
    });
    await this.local.markProgressSynced(
      profileId,
      snapshot.currentMineScore,
      snapshot.streak,
      updatedAt,
    );
  }

  private async pushProgressIfDirty(profileId: string): Promise<void> {
    const snapshot = await this.local.readProgressSnapshot(profileId);
    if (!snapshot || !ChildDataSyncUseCases.isProgressDirty(snapshot)) return;
    await this.pushProgress(profileId);
  }

  async pushUnsyncedSessions(profileId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    for (const session of await this.local.readUnsyncedSessions(profileId)) {
      const updatedAt = await this.cloud.upsertSession({ ...session, childId });
      await this.local.markSessionSynced(session.id, updatedAt);
    }
  }

  async pushUnsyncedEvaluations(profileId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    for (const evaluation of await this.local.readUnsyncedEvaluations(profileId)) {
      const updatedAt = await this.cloud.upsertSlotEvaluation({ ...evaluation, childId });
      await this.local.markEvaluationSynced(
        profileId,
        evaluation.localDayKey,
        evaluation.period,
        updatedAt,
      );
    }
  }

  /** Flush every locally pending write for one child (post-write / retry path). */
  async pushChild(profileId: string): Promise<void> {
    if (!(await this.local.resolveRemoteChildId(profileId))) return;
    await this.pushProgressIfDirty(profileId);
    await this.pushUnsyncedSessions(profileId);
    await this.pushUnsyncedEvaluations(profileId);
  }

  /** Retry path: flush every synced child's pending writes. */
  async pushAllPending(): Promise<void> {
    for (const profileId of await this.local.listSyncedProfileIds()) {
      await this.pushChild(profileId);
    }
  }

  /**
   * Multi-device recovery for Mine Puan progress. Hydrates when local is missing
   * or clean-and-stale; keeps local when it holds unpushed edits.
   */
  async recoverProgress(): Promise<void> {
    for (const row of await this.cloud.listOwnedProgress()) {
      const profileId = await this.local.findProfileByRemoteChildId(row.childId);
      if (!profileId) continue;
      const snapshot = await this.local.readProgressSnapshot(profileId);

      if (!snapshot) {
        await this.local.writeRecoveredProgress(profileId, row);
        continue;
      }
      if (ChildDataSyncUseCases.isProgressDirty(snapshot)) continue; // local wins; pushed later

      const cloudNewer =
        !snapshot.syncedAt || (row.updatedAt ? row.updatedAt > snapshot.syncedAt : false);
      const valueDiffers =
        row.currentMineScore !== snapshot.currentMineScore || row.streak !== snapshot.streak;
      if (cloudNewer && valueDiffers) {
        await this.local.writeRecoveredProgress(profileId, row);
      }
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
