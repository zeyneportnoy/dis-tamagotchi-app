import type { CloudChildProfileRepository, LocalProfileSyncRepository } from '@/domain/sync';

export class ProfileSyncUseCases {
  constructor(
    private readonly local: LocalProfileSyncRepository,
    private readonly cloud: CloudChildProfileRepository,
  ) {}

  async recoverFromCloud(parentId: string): Promise<number> {
    // age_band is never derived from date_of_birth here: the product no longer
    // collects or writes birth dates, and an existing Supabase row may still
    // carry a stale one from before that change. The explicit `age_band` the
    // cloud row carries is authoritative and is passed through as-is.
    const profiles = await this.cloud.listOwned();
    for (const profile of profiles) await this.local.upsertCloud(profile);
    await this.local.reconcileCloudSnapshot(
      parentId,
      new Set(profiles.map((profile) => profile.id)),
    );
    return profiles.length;
  }

  countLegacyProfiles(parentId: string): Promise<number> {
    return this.local.countClaimable(parentId);
  }

  async claimLegacyProfiles(parentId: string): Promise<number> {
    const profiles = await this.local.listClaimable(parentId);
    let synced = 0;
    for (const profile of profiles) {
      try {
        const cloud = await this.cloud.upsert({ ...profile, parentId });
        await this.local.markSynced(profile.id, parentId, cloud.id);
        synced += 1;
      } catch {
        await this.local.markFailed(profile.id);
      }
    }
    return synced;
  }

  /**
   * Propagate locally-queued child archive/delete operations to Supabase. RLS
   * ensures a parent can only remove its own child rows; dependent cloud rows
   * fall away by cascade. Idempotent — a removal that already succeeded (or whose
   * row is already gone) just clears from the outbox.
   */
  async flushPendingRemovals(parentId: string): Promise<void> {
    for (const removal of await this.local.listPendingRemovals(parentId)) {
      try {
        await this.cloud.remove(removal);
        await this.local.clearPendingRemoval(removal.remoteId);
      } catch {
        // Keep it in the outbox for the next retry.
      }
    }
  }
}
