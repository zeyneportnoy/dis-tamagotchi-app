export type AccessorySlot = 'wearable' | 'background' | 'decor' | 'effect' | 'brush';

export const rewardCatalog = [
  { key: 'pastel-playroom', icon: '🏡', slot: 'background', unlockXp: 0 },
  { key: 'cozy-scarf', icon: '☁️', slot: 'decor', unlockXp: 0 },
  { key: 'classic-brush', icon: '🪥', slot: 'brush', unlockXp: 0 },
  { key: 'sparkle-crown', icon: '👑', slot: 'wearable', unlockXp: 40 },
  { key: 'star-crown', icon: '⭐', slot: 'wearable', unlockXp: 80 },
  { key: 'cloud-room', icon: '☁️', slot: 'background', unlockXp: 160 },
  { key: 'heart-rug', icon: '💗', slot: 'decor', unlockXp: 120 },
  { key: 'mini-hat', icon: '🎩', slot: 'wearable', unlockXp: 160 },
  { key: 'pink-brush', icon: '🌸', slot: 'brush', unlockXp: 80 },
  { key: 'star-glasses', icon: '👓', slot: 'wearable', unlockXp: 200 },
  { key: 'rainbow-room', icon: '🌈', slot: 'background', unlockXp: 640 },
  { key: 'super-glasses', icon: '🕶️', slot: 'wearable', unlockXp: 240 },
  { key: 'toy-box', icon: '🧸', slot: 'decor', unlockXp: 260 },
  { key: 'color-glasses', icon: '🌈', slot: 'wearable', unlockXp: 280 },
  { key: 'rainbow-light', icon: '◌', slot: 'effect', unlockXp: 0 },
  { key: 'star-brush', icon: '⭐', slot: 'brush', unlockXp: 240 },
  { key: 'bow-clip', icon: '🎀', slot: 'wearable', unlockXp: 340 },
  { key: 'heart-badge', icon: '💡', slot: 'decor', unlockXp: 360 },
  { key: 'space-room', icon: '🚀', slot: 'background', unlockXp: 1280 },
  { key: 'star-badge', icon: '🪴', slot: 'decor', unlockXp: 440 },
  { key: 'gold-sparkle', icon: '✦', slot: 'effect', unlockXp: 80 },
  { key: 'mini-cape', icon: '🪥', slot: 'brush', unlockXp: 480 },
  { key: 'undersea-room', icon: '🩸', slot: 'background', unlockXp: 2200 },
  { key: 'star-sparkle', icon: '·', slot: 'effect', unlockXp: 240 },
  { key: 'mini-shelf', icon: '📚', slot: 'decor', unlockXp: 640 },
  { key: 'rainbow-brush', icon: '🌈', slot: 'brush', unlockXp: 920 },
  { key: 'confetti-glow', icon: '✧', slot: 'effect', unlockXp: 600 },
  { key: 'mini-halo', icon: '💫', slot: 'wearable', unlockXp: 760 },
  { key: 'rainbow-cape', icon: '🌅', slot: 'background', unlockXp: 3600 },
  { key: 'moon-lamp', icon: '🌙', slot: 'decor', unlockXp: 840 },
  { key: 'dino-brush', icon: '🦕', slot: 'brush', unlockXp: 1520 },
  { key: 'magic-dust', icon: '◯', slot: 'effect', unlockXp: 1200 },
  { key: 'night-room', icon: '🌌', slot: 'background', unlockXp: 960 },
  { key: 'color-pillow', icon: '🟣', slot: 'decor', unlockXp: 1000 },
  { key: 'space-brush', icon: '🚀', slot: 'brush', unlockXp: 2320 },
  { key: 'cloud-effect', icon: '✦', slot: 'effect', unlockXp: 2000 },
  { key: 'forest-room', icon: '🌲', slot: 'background', unlockXp: 1120 },
  { key: 'heart-brush', icon: '💗', slot: 'brush', unlockXp: 3200 },
] as const;

export type RewardItemKey = (typeof rewardCatalog)[number]['key'];

export function rewardItemForKey(key: RewardItemKey) {
  return rewardCatalog.find((item) => item.key === key)!;
}

export const MAIN_SLOT_REWARD_XP = 20;
export const SESSION_MOOD_DELTA = 5;
export const MAX_MOOD = 100;

export type CharacterGrowthStage = 0 | 1 | 2 | 3 | 4;

export const characterGrowthThresholds = [0, 160, 400, 1000, 1800] as const;

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
  return Math.ceil(progress.remainingXp / MAIN_SLOT_REWARD_XP);
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

/**
 * Score-gated Collection slots. A reward in one of these slots is unlocked only
 * while the child's CURRENT Mine Puan balance is at or above its `unlockXp`
 * threshold in `rewardCatalog` — nothing is remembered, so a reward re-locks the
 * moment the balance drops below the threshold and unlocks again when it
 * recovers. `rewardCatalog` is the single source shared by the unlock gate and
 * the "X Mine Puan'da açılır" card text.
 */
function scoreGatedItem(slot: AccessorySlot, key: string | null | undefined) {
  return rewardCatalog.find((item) => item.slot === slot && item.key === key);
}

function isScoreGatedRewardKey(
  slot: AccessorySlot,
  key: string | null | undefined,
): key is RewardItemKey {
  return scoreGatedItem(slot, key) !== undefined;
}

/** Mine Puan needed now, or `null` for a reward that is open from the start. */
function slotUnlockScore(slot: AccessorySlot, key: string): number | null {
  const item = scoreGatedItem(slot, key);
  return item && item.unlockXp > 0 ? item.unlockXp : null;
}

function isSlotUnlockedForScore(
  slot: AccessorySlot,
  key: string,
  currentMineScore: number,
): boolean {
  const item = scoreGatedItem(slot, key);
  if (!item) return true;
  return currentMineScore >= item.unlockXp;
}

/** The selected key while it is still unlocked, otherwise the slot's default. */
function effectiveSlotKey(
  slot: AccessorySlot,
  selectedKey: string | null | undefined,
  defaultKey: string,
  currentMineScore: number,
): string {
  if (
    isScoreGatedRewardKey(slot, selectedKey) &&
    !isSlotUnlockedForScore(slot, selectedKey, currentMineScore)
  ) {
    return defaultKey;
  }
  return selectedKey ?? defaultKey;
}

/**
 * The always-open brush every child starts with. When a score-gated brush
 * re-locks, the active brush falls back to this one.
 */
export const DEFAULT_BRUSH_KEY = 'classic-brush' as const;

export function isBrushRewardKey(key: string | null | undefined): key is RewardItemKey {
  return isScoreGatedRewardKey('brush', key);
}

export function brushUnlockScore(key: string): number | null {
  return slotUnlockScore('brush', key);
}

export function isBrushUnlockedForScore(key: string, currentMineScore: number): boolean {
  return isSlotUnlockedForScore('brush', key, currentMineScore);
}

export function effectiveBrushKey(
  selectedKey: string | null | undefined,
  currentMineScore: number,
): string {
  return effectiveSlotKey('brush', selectedKey, DEFAULT_BRUSH_KEY, currentMineScore);
}

/**
 * The always-open background every child starts with. When a score-gated
 * background re-locks, the active background falls back to this one.
 */
export const DEFAULT_BACKGROUND_KEY = 'pastel-playroom' as const;

export function isBackgroundRewardKey(key: string | null | undefined): key is RewardItemKey {
  return isScoreGatedRewardKey('background', key);
}

export function backgroundUnlockScore(key: string): number | null {
  return slotUnlockScore('background', key);
}

export function isBackgroundUnlockedForScore(key: string, currentMineScore: number): boolean {
  return isSlotUnlockedForScore('background', key, currentMineScore);
}

export function effectiveBackgroundKey(
  selectedKey: string | null | undefined,
  currentMineScore: number,
): string {
  return effectiveSlotKey('background', selectedKey, DEFAULT_BACKGROUND_KEY, currentMineScore);
}

/**
 * The always-open scene effect every child starts with. When a score-gated
 * effect re-locks, the active effect falls back to this one.
 */
export const DEFAULT_EFFECT_KEY = 'rainbow-light' as const;

export function isEffectRewardKey(key: string | null | undefined): key is RewardItemKey {
  return isScoreGatedRewardKey('effect', key);
}

export function effectUnlockScore(key: string): number | null {
  return slotUnlockScore('effect', key);
}

export function isEffectUnlockedForScore(key: string, currentMineScore: number): boolean {
  return isSlotUnlockedForScore('effect', key, currentMineScore);
}

export function effectiveEffectKey(
  selectedKey: string | null | undefined,
  currentMineScore: number,
): string {
  return effectiveSlotKey('effect', selectedKey, DEFAULT_EFFECT_KEY, currentMineScore);
}
