import type { ChildProfile, StarterAvatarKey, StoredAgeBand } from '@/domain/family';

export type ChildProfileViewModel = Readonly<{
  id: string;
  nickname: string;
  ageBand: StoredAgeBand;
  avatarId: StarterAvatarKey;
}>;

export const toChildProfileViewModel = (profile: ChildProfile): ChildProfileViewModel => ({
  id: profile.id,
  nickname: profile.nickname,
  ageBand: profile.ageBand,
  avatarId: profile.avatarId,
});
