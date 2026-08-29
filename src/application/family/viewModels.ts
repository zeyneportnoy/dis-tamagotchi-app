import type { ChildProfile, StarterAvatarKey, StoredAgeBand } from '@/domain/family';

export type ChildProfileViewModel = Readonly<{
  id: string;
  nickname: string;
  dateOfBirth: string | null;
  ageBand: StoredAgeBand;
  avatarId: StarterAvatarKey;
  createdAt: string;
}>;

export const toChildProfileViewModel = (profile: ChildProfile): ChildProfileViewModel => ({
  id: profile.id,
  nickname: profile.nickname,
  dateOfBirth: profile.dateOfBirth,
  ageBand: profile.ageBand,
  avatarId: profile.avatarId,
  createdAt: profile.createdAt,
});
