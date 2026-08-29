export type AgeBand = '4_6' | '7_11';
export type LegacyAgeBand = '6_8' | '9_10';
export type StoredAgeBand = AgeBand | LegacyAgeBand;
export const starterAvatarKeys = [
  'inci',
  'piril',
  'kaan',
  'milo',
  'zipzip',
  'topi',
  'akil',
  'uyku',
] as const;
export type StarterAvatarKey = (typeof starterAvatarKeys)[number];
export type ProfileSyncStatus = 'legacy_local' | 'pending' | 'synced' | 'failed';

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
  dateOfBirth: string | null;
  ageBand: StoredAgeBand;
  avatarId: StarterAvatarKey;
  createdAt: string;
  archivedAt: string | null;
  remoteId: string | null;
  parentAuthUserId: string | null;
  syncStatus: ProfileSyncStatus;
  updatedAt: string;
}>;

export type CreateChildProfileInput = Readonly<{
  familyId: string;
  nickname: string;
  dateOfBirth: string;
  avatarId: StarterAvatarKey;
}>;

export type UpdateChildProfileInput = Readonly<{
  nickname?: string;
  ageBand?: AgeBand;
  dateOfBirth?: string;
  avatarId?: StarterAvatarKey;
}>;

export type BrushingPeriod = 'morning' | 'evening';

export type ProfileProgress = Readonly<{
  childProfileId: string;
  statusDate: string;
  morningCompleted: boolean;
  eveningCompleted: boolean;
  currentStreak: number;
  totalXp: number;
  level: number;
  mood: number;
  lastInteractionAt: string | null;
  lastBrushingAt: string | null;
}>;

export type BrushingSession = Readonly<{
  id: string;
  profileId: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  completed: boolean;
  period: BrushingPeriod | null;
  createdAt: string;
  rewardGrantedAt: string | null;
  xpGranted: number;
  moodDelta: number;
  unlockedItemKey: string | null;
  localDayKey: string | null;
}>;

export type CompleteBrushingSessionInput = Readonly<{
  sessionId?: string;
  profileId: string;
  startedAt: string;
  durationSeconds: number;
}>;
