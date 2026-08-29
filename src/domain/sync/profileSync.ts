import type { AgeBand, StarterAvatarKey } from '@/domain/family';

export type CloudChildProfile = Readonly<{
  id: string;
  parentId: string;
  nickname: string;
  /** Exact date of birth (YYYY-MM-DD); the source of truth `ageBand` is derived from. */
  dateOfBirth: string | null;
  ageBand: AgeBand;
  avatarId: StarterAvatarKey;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}>;

export interface CloudChildProfileRepository {
  listOwned(): Promise<readonly CloudChildProfile[]>;
  upsert(profile: CloudChildProfile): Promise<CloudChildProfile>;
}

export interface LocalProfileSyncRepository {
  listClaimable(parentId: string): Promise<readonly CloudChildProfile[]>;
  countClaimable(parentId: string): Promise<number>;
  upsertCloud(profile: CloudChildProfile): Promise<void>;
  markSynced(localId: string, parentId: string, remoteId: string): Promise<void>;
  markFailed(localId: string): Promise<void>;
}
