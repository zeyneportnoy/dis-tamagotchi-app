import type { ChildProfile, StoredAgeBand } from '@/domain/family';

export type ChildProfileViewModel = Readonly<{
  id: string;
  nickname: string;
  ageBand: StoredAgeBand;
  avatarId: string;
}>;

export const toChildProfileViewModel = (profile: ChildProfile): ChildProfileViewModel => ({
  id: profile.id,
  nickname: profile.nickname,
  ageBand: profile.ageBand,
  avatarId: profile.avatarId,
});
