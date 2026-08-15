import type { CloudChildProfileRepository, LocalProfileSyncRepository } from '@/domain/sync';

export class ProfileSyncUseCases {
  constructor(
    private readonly local: LocalProfileSyncRepository,
    private readonly cloud: CloudChildProfileRepository,
  ) {}

  async recoverFromCloud(): Promise<number> {
    const profiles = await this.cloud.listOwned();
    for (const profile of profiles) await this.local.upsertCloud(profile);
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
}
