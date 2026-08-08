export type AgeBand = '4_6' | '7_11';
export type LegacyAgeBand = '6_8' | '9_10';
export type StoredAgeBand = AgeBand | LegacyAgeBand;
export type StarterAvatarKey = 'cheerful-incisor' | 'sleepy-molar' | 'brave-canine';

export type Family = Readonly<{
  id: string;
  createdAt: string;
  locale: string;
  timezone: string;
  cloudAccountId: string | null;
}>;

export type ChildProfile = Readonly<{
  id: string;
  familyId: string;
  nickname: string;
  ageBand: StoredAgeBand;
  avatarId: StarterAvatarKey;
  createdAt: string;
  archivedAt: string | null;
}>;

export type CreateChildProfileInput = Readonly<{
  familyId: string;
  nickname: string;
  ageBand: AgeBand;
  avatarId: StarterAvatarKey;
}>;

export type UpdateChildProfileInput = Readonly<{
  nickname?: string;
  ageBand?: AgeBand;
  avatarId?: StarterAvatarKey;
}>;

export type BrushingPeriod = 'morning' | 'evening';

export type ProfileProgress = Readonly<{
  childProfileId: string;
  statusDate: string;
  morningCompleted: boolean;
  eveningCompleted: boolean;
  currentStreak: number;
  lastInteractionAt: string | null;
  lastBrushingAt: string | null;
}>;
