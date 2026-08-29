import { ageBandFromDateOfBirth } from '@/domain/family';
import type {
  CloudChildProfile,
  CloudChildProfileRepository,
  LocalProfileSyncRepository,
} from '@/domain/sync';

/**
 * Exact date of birth is the source of truth: when a cloud profile carries a
 * DOB, re-derive its age band from it so a stale `age_band` written earlier in
 * Supabase never misroutes the app.
 */
function withDerivedAgeBand(profile: CloudChildProfile): CloudChildProfile {
  if (!profile.dateOfBirth) return profile;
  const derived = ageBandFromDateOfBirth(profile.dateOfBirth);
  return derived && derived !== profile.ageBand ? { ...profile, ageBand: derived } : profile;
}

export class ProfileSyncUseCases {
  constructor(
    private readonly local: LocalProfileSyncRepository,
    private readonly cloud: CloudChildProfileRepository,
  ) {}

  async recoverFromCloud(): Promise<number> {
    const profiles = await this.cloud.listOwned();
    for (const profile of profiles) await this.local.upsertCloud(withDerivedAgeBand(profile));
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
