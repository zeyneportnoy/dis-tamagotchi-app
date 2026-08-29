import type { BrushingPeriod, BrushingSession, ProfileProgress } from '@/domain/family';

import type { AccessorySlot, RewardItemKey } from './catalog';

export type DailyProgress = Readonly<{
  childProfileId: string;
  localDayKey: string;
  morningCompleted: boolean;
  eveningCompleted: boolean;
  fullDayCompleted: boolean;
  streakAfterDay: number;
}>;

export type InventoryItem = Readonly<{
  key: RewardItemKey;
  unlocked: boolean;
  equipped: boolean;
  unlockedAt: string | null;
  unlockXp: number;
  icon: string;
  slot: AccessorySlot;
}>;

export type BrushingRewardResult = Readonly<{
  session: BrushingSession;
  xpGranted: number;
  moodDelta: number;
  unlockedItemKey: RewardItemKey | null;
  dailyProgress: DailyProgress;
  progress: ProfileProgress;
  firstSlotCompletion: boolean;
  streakAdvanced: boolean;
}>;

export type FinishBrushingSessionInput = Readonly<{
  sessionId: string;
  profileId: string;
  startedAt: string;
  durationSeconds: number;
  completed?: boolean;
}>;

export type BeginBrushingSessionInput = Readonly<{
  sessionId: string;
  profileId: string;
  startedAt: string;
}>;

export type BrushingSlotEvaluation = Readonly<{
  childProfileId: string;
  localDayKey: string;
  period: BrushingPeriod;
  outcome: 'completed' | 'missed';
  penaltyAmount: -10 | 0;
  scoreBefore: number;
  scoreAfter: number;
  evaluatedAt: string;
}>;
