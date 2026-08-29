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

  it('never promises a stage transition before the guaranteed session XP reaches it', () => {
    expect(estimatedBrushingsToNextStage(140)).toBe(2);
    expect(estimatedBrushingsToNextStage(150)).toBe(1);
    expect(growthStageForXp(150 + 10)).toBe(1);
    expect(estimatedBrushingsToNextStage(390)).toBe(1);
    expect(growthStageForXp(390 + 10)).toBe(2);
    expect(estimatedBrushingsToNextStage(1800)).toBe(0);
  });

  it('derives backward evolution directly from the current score', () => {
    expect(growthStageForXp(405)).toBe(2);
    expect(growthStageForXp(395)).toBe(1);
    expect(growthStageForXp(165)).toBe(1);
    expect(growthStageForXp(155)).toBe(0);
  });
});
