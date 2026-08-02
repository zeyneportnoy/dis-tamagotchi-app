import type { ChildProfile } from '@/domain/family';

export type ChildProfileViewModel = Readonly<{
  id: string;
  nickname: string;
  ageBand: '6_8' | '9_10';
  avatarId: string;
}>;

export const toChildProfileViewModel = (profile: ChildProfile): ChildProfileViewModel => ({
  id: profile.id,
  nickname: profile.nickname,
  ageBand: profile.ageBand,
  avatarId: profile.avatarId,
});
