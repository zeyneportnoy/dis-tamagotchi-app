import type { CloudChildDataRepository, LocalChildCloudSyncRepository } from '@/domain/sync';

/**
 * Orchestrates best-effort cloud persistence + recovery for a child's Mine Puan
 * progress, brushing sessions and slot evaluations. It never computes score —
 * the local SQLite transaction has already produced the truth by the time any
 * method here runs.
 */
export class ChildDataSyncUseCases {
  constructor(
    private readonly local: LocalChildCloudSyncRepository,
    private readonly cloud: CloudChildDataRepository,
  ) {}

  async pushProgress(profileId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    const progress = await this.local.readProgressForPush(profileId);
    if (!progress) return;
    await this.cloud.upsertProgress({
      childId,
      currentMineScore: progress.currentMineScore,
      streak: progress.streak,
    });
  }

  async pushSession(profileId: string, sessionId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    const session = await this.local.readSessionForPush(profileId, sessionId);
    if (!session) return;
    await this.cloud.upsertSession({ ...session, childId });
  }

  async pushRecentEvaluations(profileId: string, sinceDayKey: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    const evaluations = await this.local.readRecentEvaluationsForPush(profileId, sinceDayKey);
    for (const evaluation of evaluations) {
      await this.cloud.upsertSlotEvaluation({ ...evaluation, childId });
    }
  }

  /**
   * Hydrate cloud progress into local SQLite for children that have no local
   * `profile_progress` row yet (fresh install / cleared cache). Existing local
   * rows are left untouched.
   */
  async recoverProgress(): Promise<number> {
    const rows = await this.cloud.listOwnedProgress();
    let hydrated = 0;
    for (const row of rows) {
      const profileId = await this.local.findHydratableProfile(row.childId);
      if (!profileId) continue;
      await this.local.hydrateProgress(profileId, row);
      hydrated += 1;
    }
    return hydrated;
  }
}
