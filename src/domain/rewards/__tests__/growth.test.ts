import {
  estimatedBrushingsToNextStage,
  growthProgressForXp,
  growthStageForXp,
  nextGrowthThreshold,
} from '../catalog';

describe('character growth stages', () => {
  it.each([
    [0, 0],
    [159, 0],
    [160, 1],
    [399, 1],
    [400, 2],
    [999, 2],
    [1000, 3],
    [1799, 3],
    [1800, 4],
    [2400, 4],
  ] as const)('maps %i XP to visual stage %i', (xp, stage) => {
    expect(growthStageForXp(xp)).toBe(stage);
  });

  it('keeps the developed target capped', () => {
    expect(nextGrowthThreshold(0)).toBe(160);
    expect(nextGrowthThreshold(4)).toBe(1800);
  });

  it('describes visible progress without changing growth thresholds', () => {
    expect(growthProgressForXp(550)).toEqual({
      currentStage: 2,
      isFinalStage: false,
      nextStage: 3,
      ratio: 0.25,
      remainingXp: 450,
      targetXp: 1000,
    });
    expect(growthProgressForXp(1900)).toEqual({
      currentStage: 4,
      isFinalStage: true,
      nextStage: null,
      ratio: 1,
      remainingXp: 0,
      targetXp: 1800,
    });
  });

  it.each([
    [40, 120, 6],
    [30, 130, 7],
    [60, 100, 5],
    [120, 40, 2],
    [140, 20, 1],
    [159, 1, 1],
  ] as const)(
    'at %i Mine, estimates %i remaining as %i rewarded brushings',
    (xp, remainingXp, brushings) => {
      expect(growthProgressForXp(xp).remainingXp).toBe(remainingXp);
      expect(estimatedBrushingsToNextStage(xp)).toBe(brushings);
    },
  );

  it('reports no remaining brushings at the final stage', () => {
    expect(estimatedBrushingsToNextStage(1800)).toBe(0);
  });

  it('derives backward evolution directly from the current score', () => {
    expect(growthStageForXp(405)).toBe(2);
    expect(growthStageForXp(395)).toBe(1);
    expect(growthStageForXp(165)).toBe(1);
    expect(growthStageForXp(155)).toBe(0);
  });
});
