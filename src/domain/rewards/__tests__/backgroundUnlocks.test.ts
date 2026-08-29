import {
  DEFAULT_BACKGROUND_KEY,
  backgroundUnlockScore,
  effectiveBackgroundKey,
  isBackgroundRewardKey,
  isBackgroundUnlockedForScore,
  rewardCatalog,
} from '../catalog';

// Binding background order + Mine Puan thresholds from the spec.
const backgroundThresholds = [
  ['pastel-playroom', 0],
  ['cloud-room', 160],
  ['rainbow-room', 640],
  ['space-room', 1280],
  ['undersea-room', 2200],
  ['rainbow-cape', 3600],
] as const;

describe('background unlock thresholds', () => {
  it('keeps rewardCatalog as the single source for every background threshold', () => {
    for (const [key, threshold] of backgroundThresholds) {
      const item = rewardCatalog.find((entry) => entry.key === key);
      expect(item).toBeDefined();
      expect(item?.slot).toBe('background');
      expect(item?.unlockXp).toBe(threshold);
    }
  });

  it('exposes the target score only for backgrounds that are not open from the start', () => {
    expect(backgroundUnlockScore('pastel-playroom')).toBeNull();
    expect(backgroundUnlockScore('cloud-room')).toBe(160);
    expect(backgroundUnlockScore('rainbow-room')).toBe(640);
    expect(backgroundUnlockScore('space-room')).toBe(1280);
    expect(backgroundUnlockScore('undersea-room')).toBe(2200);
    expect(backgroundUnlockScore('rainbow-cape')).toBe(3600);
  });

  it('recognises the six score-gated background keys only', () => {
    for (const [key] of backgroundThresholds) expect(isBackgroundRewardKey(key)).toBe(true);
    expect(isBackgroundRewardKey('classic-brush')).toBe(false);
    expect(isBackgroundRewardKey(undefined)).toBe(false);
  });
});

describe('isBackgroundUnlockedForScore — current Mine Puan balance, never lifetime', () => {
  it('opens only Pastel Oyun Odası at 0', () => {
    expect(isBackgroundUnlockedForScore('pastel-playroom', 0)).toBe(true);
    expect(isBackgroundUnlockedForScore('cloud-room', 0)).toBe(false);
  });

  it('unlocks each background exactly at its threshold and re-locks one point below', () => {
    for (const [key, threshold] of backgroundThresholds) {
      if (threshold === 0) continue;
      expect(isBackgroundUnlockedForScore(key, threshold - 1)).toBe(false);
      expect(isBackgroundUnlockedForScore(key, threshold)).toBe(true);
    }
  });

  it('covers every spec boundary example', () => {
    expect(isBackgroundUnlockedForScore('cloud-room', 159)).toBe(false);
    expect(isBackgroundUnlockedForScore('cloud-room', 160)).toBe(true);
    expect(isBackgroundUnlockedForScore('rainbow-room', 639)).toBe(false);
    expect(isBackgroundUnlockedForScore('rainbow-room', 640)).toBe(true);
    expect(isBackgroundUnlockedForScore('space-room', 1279)).toBe(false);
    expect(isBackgroundUnlockedForScore('space-room', 1280)).toBe(true);
    expect(isBackgroundUnlockedForScore('undersea-room', 2199)).toBe(false);
    expect(isBackgroundUnlockedForScore('undersea-room', 2200)).toBe(true);
    expect(isBackgroundUnlockedForScore('rainbow-cape', 3599)).toBe(false);
    expect(isBackgroundUnlockedForScore('rainbow-cape', 3600)).toBe(true);
  });

  it('unlocks cumulatively — at 1280 every earlier background is open, later ones locked', () => {
    const open = ['pastel-playroom', 'cloud-room', 'rainbow-room', 'space-room'];
    const locked = ['undersea-room', 'rainbow-cape'];
    for (const key of open) expect(isBackgroundUnlockedForScore(key, 1280)).toBe(true);
    for (const key of locked) expect(isBackgroundUnlockedForScore(key, 1280)).toBe(false);
  });

  it('re-locks Gökkuşağı Işıltısı the moment a -10 penalty drops the balance to 630', () => {
    expect(isBackgroundUnlockedForScore('rainbow-room', 640)).toBe(true);
    expect(isBackgroundUnlockedForScore('rainbow-room', 630)).toBe(false);
    expect(isBackgroundUnlockedForScore('rainbow-room', 640)).toBe(true);
  });
});

describe('effectiveBackgroundKey', () => {
  it('keeps the selected background while it is still affordable', () => {
    expect(effectiveBackgroundKey('rainbow-room', 640)).toBe('rainbow-room');
    expect(effectiveBackgroundKey('rainbow-cape', 9000)).toBe('rainbow-cape');
  });

  it('falls back to Pastel Oyun Odası when the selection re-locks after a penalty', () => {
    expect(effectiveBackgroundKey('rainbow-room', 630)).toBe(DEFAULT_BACKGROUND_KEY);
    expect(effectiveBackgroundKey('rainbow-room', 630)).toBe('pastel-playroom');
  });

  it('never locks the default background and tolerates an empty selection', () => {
    expect(effectiveBackgroundKey('pastel-playroom', 0)).toBe('pastel-playroom');
    expect(effectiveBackgroundKey(undefined, 0)).toBe('pastel-playroom');
    expect(effectiveBackgroundKey(null, 5000)).toBe('pastel-playroom');
  });
});
