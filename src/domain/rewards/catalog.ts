export type AccessorySlot = 'wearable' | 'background' | 'decor' | 'effect' | 'brush';

export const rewardCatalog = [
  { key: 'pastel-playroom', icon: '🏡', slot: 'background', unlockXp: 0 },
  { key: 'cozy-scarf', icon: '☁️', slot: 'decor', unlockXp: 0 },
  { key: 'bubble-glow', icon: '🫧', slot: 'effect', unlockXp: 0 },
  { key: 'classic-brush', icon: '🪥', slot: 'brush', unlockXp: 0 },
  { key: 'sparkle-crown', icon: '👑', slot: 'wearable', unlockXp: 40 },
  { key: 'star-crown', icon: '⭐', slot: 'wearable', unlockXp: 80 },
  { key: 'cloud-room', icon: '☁️', slot: 'background', unlockXp: 100 },
  { key: 'heart-rug', icon: '💗', slot: 'decor', unlockXp: 120 },
  { key: 'heart-flight', icon: '💕', slot: 'effect', unlockXp: 140 },
  { key: 'mini-hat', icon: '🎩', slot: 'wearable', unlockXp: 160 },
  { key: 'pink-brush', icon: '🌸', slot: 'brush', unlockXp: 180 },
  { key: 'star-glasses', icon: '👓', slot: 'wearable', unlockXp: 200 },
  { key: 'rainbow-room', icon: '🌈', slot: 'background', unlockXp: 220 },
  { key: 'super-glasses', icon: '🕶️', slot: 'wearable', unlockXp: 240 },
  { key: 'toy-box', icon: '🧸', slot: 'decor', unlockXp: 260 },
  { key: 'color-glasses', icon: '🌈', slot: 'wearable', unlockXp: 280 },
  { key: 'rainbow-light', icon: '🌈', slot: 'effect', unlockXp: 300 },
  { key: 'star-brush', icon: '⭐', slot: 'brush', unlockXp: 320 },
  { key: 'bow-clip', icon: '🎀', slot: 'wearable', unlockXp: 340 },
  { key: 'heart-badge', icon: '💡', slot: 'decor', unlockXp: 360 },
  { key: 'space-room', icon: '🚀', slot: 'background', unlockXp: 400 },
  { key: 'star-badge', icon: '🪴', slot: 'decor', unlockXp: 440 },
  { key: 'gold-sparkle', icon: '🌟', slot: 'effect', unlockXp: 480 },
  { key: 'mini-cape', icon: '🪥', slot: 'brush', unlockXp: 520 },
  { key: 'undersea-room', icon: '🩸', slot: 'background', unlockXp: 560 },
  { key: 'star-sparkle', icon: '✨', slot: 'effect', unlockXp: 600 },
  { key: 'mini-shelf', icon: '📚', slot: 'decor', unlockXp: 640 },
  { key: 'rainbow-brush', icon: '🌈', slot: 'brush', unlockXp: 680 },
  { key: 'confetti-glow', icon: '🎉', slot: 'effect', unlockXp: 720 },
  { key: 'mini-halo', icon: '💫', slot: 'wearable', unlockXp: 760 },
  { key: 'rainbow-cape', icon: '🌅', slot: 'background', unlockXp: 800 },
  { key: 'moon-lamp', icon: '🌙', slot: 'decor', unlockXp: 840 },
  { key: 'dino-brush', icon: '🦕', slot: 'brush', unlockXp: 880 },
  { key: 'magic-dust', icon: '🪄', slot: 'effect', unlockXp: 920 },
  { key: 'night-room', icon: '🌌', slot: 'background', unlockXp: 960 },
  { key: 'color-pillow', icon: '🟣', slot: 'decor', unlockXp: 1000 },
  { key: 'space-brush', icon: '🚀', slot: 'brush', unlockXp: 1040 },
  { key: 'cloud-effect', icon: '☁️', slot: 'effect', unlockXp: 1080 },
  { key: 'forest-room', icon: '🌲', slot: 'background', unlockXp: 1120 },
  { key: 'heart-brush', icon: '💗', slot: 'brush', unlockXp: 1200 },
] as const;

export type RewardItemKey = (typeof rewardCatalog)[number]['key'];

export function rewardItemForKey(key: RewardItemKey) {
  return rewardCatalog.find((item) => item.key === key)!;
}

export const SESSION_XP = 10;
export const FIRST_DAILY_SLOT_BONUS_XP = 10;
export const SESSION_MOOD_DELTA = 5;
export const MAX_MOOD = 100;

export type CharacterGrowthStage = 0 | 1 | 2 | 3 | 4;

export const characterGrowthThresholds = [0, 60, 120, 320, 640] as const;

export const characterGrowthStageNames = [
  'egg',
  'cracking',
  'baby',
  'growing',
  'developed',
] as const;

export function growthStageForXp(xp: number): CharacterGrowthStage {
  if (xp >= characterGrowthThresholds[4]) return 4;
  if (xp >= characterGrowthThresholds[3]) return 3;
  if (xp >= characterGrowthThresholds[2]) return 2;
  if (xp >= characterGrowthThresholds[1]) return 1;
  return 0;
}

export function nextGrowthThreshold(stage: CharacterGrowthStage): number {
  return characterGrowthThresholds[Math.min(4, stage + 1) as CharacterGrowthStage];
}

export function growthProgressForXp(xp: number): Readonly<{
  currentStage: CharacterGrowthStage;
  isFinalStage: boolean;
  nextStage: CharacterGrowthStage | null;
  ratio: number;
  remainingXp: number;
  targetXp: number;
}> {
  const safeXp = Math.max(0, xp);
  const currentStage = growthStageForXp(safeXp);
  const isFinalStage = currentStage === 4;
  const targetXp = nextGrowthThreshold(currentStage);
  const startXp = characterGrowthThresholds[currentStage];
  const ratio = isFinalStage ? 1 : Math.min(1, (safeXp - startXp) / (targetXp - startXp));

  return {
    currentStage,
    isFinalStage,
    nextStage: isFinalStage ? null : ((currentStage + 1) as CharacterGrowthStage),
    ratio,
    remainingXp: isFinalStage ? 0 : Math.max(0, targetXp - safeXp),
    targetXp,
  };
}

export function estimatedBrushingsToNextStage(xp: number): number {
  const progress = growthProgressForXp(xp);
  if (progress.isFinalStage) return 0;
  return Math.ceil(progress.remainingXp / SESSION_XP);
}

export function levelForXp(xp: number): 1 | 2 | 3 {
  if (xp >= characterGrowthThresholds[3]) return 3;
  if (xp >= characterGrowthThresholds[2]) return 2;
  return 1;
}

export function newlyUnlockedReward(previousXp: number, nextXp: number): RewardItemKey | null {
  return (
    rewardCatalog.find((item) => item.unlockXp > previousXp && item.unlockXp <= nextXp)?.key ?? null
  );
}
