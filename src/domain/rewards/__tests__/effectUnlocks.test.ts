import {
  DEFAULT_EFFECT_KEY,
  effectUnlockScore,
  effectiveEffectKey,
  isEffectRewardKey,
  isEffectUnlockedForScore,
  rewardCatalog,
} from '../catalog';

// Binding effect order + Mine Puan thresholds from the spec.
const effectThresholds = [
  ['rainbow-light', 0],
  ['gold-sparkle', 80],
  ['star-sparkle', 240],
  ['confetti-glow', 600],
  ['magic-dust', 1200],
  ['cloud-effect', 2000],
] as const;

describe('effect unlock thresholds', () => {
  it('keeps rewardCatalog as the single source for every effect threshold', () => {
    for (const [key, threshold] of effectThresholds) {
      const item = rewardCatalog.find((entry) => entry.key === key);
      expect(item).toBeDefined();
      expect(item?.slot).toBe('effect');
      expect(item?.unlockXp).toBe(threshold);
    }
  });

  it('exposes the target score only for effects that are not open from the start', () => {
    expect(effectUnlockScore('rainbow-light')).toBeNull();
    expect(effectUnlockScore('gold-sparkle')).toBe(80);
    expect(effectUnlockScore('star-sparkle')).toBe(240);
    expect(effectUnlockScore('confetti-glow')).toBe(600);
    expect(effectUnlockScore('magic-dust')).toBe(1200);
    expect(effectUnlockScore('cloud-effect')).toBe(2000);
  });

  it('recognises the six score-gated effect keys only', () => {
    for (const [key] of effectThresholds) expect(isEffectRewardKey(key)).toBe(true);
    expect(isEffectRewardKey('classic-brush')).toBe(false);
    expect(isEffectRewardKey('pastel-playroom')).toBe(false);
    expect(isEffectRewardKey(undefined)).toBe(false);
  });
});

describe('isEffectUnlockedForScore — current Mine Puan balance, never lifetime', () => {
  it('opens only Gökkuşağı Parıltısı at 0', () => {
    expect(isEffectUnlockedForScore('rainbow-light', 0)).toBe(true);
    expect(isEffectUnlockedForScore('gold-sparkle', 0)).toBe(false);
  });

  it('unlocks each effect exactly at its threshold and re-locks one point below', () => {
    for (const [key, threshold] of effectThresholds) {
      if (threshold === 0) continue;
      expect(isEffectUnlockedForScore(key, threshold - 1)).toBe(false);
      expect(isEffectUnlockedForScore(key, threshold)).toBe(true);
    }
  });

  it('covers every spec boundary example', () => {
    expect(isEffectUnlockedForScore('gold-sparkle', 79)).toBe(false);
    expect(isEffectUnlockedForScore('gold-sparkle', 80)).toBe(true);
    expect(isEffectUnlockedForScore('star-sparkle', 239)).toBe(false);
    expect(isEffectUnlockedForScore('star-sparkle', 240)).toBe(true);
    expect(isEffectUnlockedForScore('confetti-glow', 599)).toBe(false);
    expect(isEffectUnlockedForScore('confetti-glow', 600)).toBe(true);
    expect(isEffectUnlockedForScore('magic-dust', 1199)).toBe(false);
    expect(isEffectUnlockedForScore('magic-dust', 1200)).toBe(true);
    expect(isEffectUnlockedForScore('cloud-effect', 1999)).toBe(false);
    expect(isEffectUnlockedForScore('cloud-effect', 2000)).toBe(true);
  });

  it('unlocks cumulatively — at 600 the first four effects are open, later ones locked', () => {
    const open = ['rainbow-light', 'gold-sparkle', 'star-sparkle', 'confetti-glow'];
    const locked = ['magic-dust', 'cloud-effect'];
    for (const key of open) expect(isEffectUnlockedForScore(key, 600)).toBe(true);
    for (const key of locked) expect(isEffectUnlockedForScore(key, 600)).toBe(false);
  });

  it('re-locks Minik Işıklar the moment a -10 penalty drops the balance to 230', () => {
    expect(isEffectUnlockedForScore('star-sparkle', 240)).toBe(true);
    expect(isEffectUnlockedForScore('star-sparkle', 230)).toBe(false);
    expect(isEffectUnlockedForScore('star-sparkle', 240)).toBe(true);
  });
});

describe('effectiveEffectKey', () => {
  it('keeps the selected effect while it is still affordable', () => {
    expect(effectiveEffectKey('star-sparkle', 240)).toBe('star-sparkle');
    expect(effectiveEffectKey('cloud-effect', 9000)).toBe('cloud-effect');
  });

  it('falls back to Gökkuşağı Parıltısı when the selection re-locks after a penalty', () => {
    expect(effectiveEffectKey('star-sparkle', 230)).toBe(DEFAULT_EFFECT_KEY);
    expect(effectiveEffectKey('star-sparkle', 230)).toBe('rainbow-light');
  });

  it('never locks the default effect and tolerates an empty selection', () => {
    expect(effectiveEffectKey('rainbow-light', 0)).toBe('rainbow-light');
    expect(effectiveEffectKey(undefined, 0)).toBe('rainbow-light');
    expect(effectiveEffectKey(null, 5000)).toBe('rainbow-light');
  });
});
