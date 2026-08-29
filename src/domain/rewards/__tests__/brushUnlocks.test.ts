import {
  DEFAULT_BRUSH_KEY,
  brushUnlockScore,
  effectiveBrushKey,
  isBrushRewardKey,
  isBrushUnlockedForScore,
  rewardCatalog,
} from '../catalog';

// Binding brush order + Mine Puan thresholds from the spec.
const brushThresholds = [
  ['classic-brush', 0],
  ['pink-brush', 80],
  ['star-brush', 240],
  ['mini-cape', 480],
  ['rainbow-brush', 920],
  ['dino-brush', 1520],
  ['space-brush', 2320],
  ['heart-brush', 3200],
] as const;

describe('brush unlock thresholds', () => {
  it('keeps the catalog as the single source for every brush threshold', () => {
    for (const [key, threshold] of brushThresholds) {
      const item = rewardCatalog.find((entry) => entry.key === key);
      expect(item).toBeDefined();
      expect(item?.slot).toBe('brush');
      expect(item?.unlockXp).toBe(threshold);
    }
  });

  it('exposes the target score only for brushes that are not open from the start', () => {
    expect(brushUnlockScore('classic-brush')).toBeNull();
    expect(brushUnlockScore('pink-brush')).toBe(80);
    expect(brushUnlockScore('star-brush')).toBe(240);
    expect(brushUnlockScore('mini-cape')).toBe(480);
    expect(brushUnlockScore('rainbow-brush')).toBe(920);
    expect(brushUnlockScore('dino-brush')).toBe(1520);
    expect(brushUnlockScore('space-brush')).toBe(2320);
    expect(brushUnlockScore('heart-brush')).toBe(3200);
  });

  it('recognises the eight score-gated brush keys', () => {
    for (const [key] of brushThresholds) expect(isBrushRewardKey(key)).toBe(true);
    expect(isBrushRewardKey('rainbow-room')).toBe(false);
    expect(isBrushRewardKey(undefined)).toBe(false);
  });
});

describe('isBrushUnlockedForScore — current Mine Puan balance, never lifetime', () => {
  it('opens only the classic brush at 0', () => {
    expect(isBrushUnlockedForScore('classic-brush', 0)).toBe(true);
    expect(isBrushUnlockedForScore('pink-brush', 0)).toBe(false);
    expect(isBrushUnlockedForScore('star-brush', 0)).toBe(false);
  });

  it('unlocks each brush exactly at its threshold and re-locks one point below', () => {
    for (const [key, threshold] of brushThresholds) {
      if (threshold === 0) continue;
      expect(isBrushUnlockedForScore(key, threshold - 1)).toBe(false);
      expect(isBrushUnlockedForScore(key, threshold)).toBe(true);
    }
  });

  it('unlocks cumulatively — at 920 every earlier brush is open, later ones locked', () => {
    const open = ['classic-brush', 'pink-brush', 'star-brush', 'mini-cape', 'rainbow-brush'];
    const locked = ['dino-brush', 'space-brush', 'heart-brush'];
    for (const key of open) expect(isBrushUnlockedForScore(key, 920)).toBe(true);
    for (const key of locked) expect(isBrushUnlockedForScore(key, 920)).toBe(false);
  });

  it('re-locks the Star brush the moment a -10 penalty drops the balance to 230', () => {
    expect(isBrushUnlockedForScore('star-brush', 240)).toBe(true);
    expect(isBrushUnlockedForScore('star-brush', 230)).toBe(false);
    // …and it opens again once the balance climbs back to 240.
    expect(isBrushUnlockedForScore('star-brush', 240)).toBe(true);
  });
});

describe('effectiveBrushKey', () => {
  it('keeps the selected brush while it is still affordable', () => {
    expect(effectiveBrushKey('star-brush', 240)).toBe('star-brush');
    expect(effectiveBrushKey('rainbow-brush', 5000)).toBe('rainbow-brush');
  });

  it('falls back to the classic brush when the selection re-locks after a penalty', () => {
    expect(effectiveBrushKey('star-brush', 230)).toBe(DEFAULT_BRUSH_KEY);
    expect(effectiveBrushKey('star-brush', 230)).toBe('classic-brush');
  });

  it('never locks the classic brush and tolerates an empty selection', () => {
    expect(effectiveBrushKey('classic-brush', 0)).toBe('classic-brush');
    expect(effectiveBrushKey(undefined, 0)).toBe('classic-brush');
    expect(effectiveBrushKey(null, 999)).toBe('classic-brush');
  });
});
