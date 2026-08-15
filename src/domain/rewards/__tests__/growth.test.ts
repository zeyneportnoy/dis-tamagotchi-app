import {
  estimatedBrushingsToNextStage,
  growthProgressForXp,
  growthStageForXp,
  nextGrowthThreshold,
} from '../catalog';

describe('character growth stages', () => {
  it.each([
    [0, 0],
    [59, 0],
    [60, 1],
    [119, 1],
    [120, 2],
    [319, 2],
    [320, 3],
    [639, 3],
    [640, 4],
    [1200, 4],
  ] as const)('maps %i XP to visual stage %i', (xp, stage) => {
    expect(growthStageForXp(xp)).toBe(stage);
  });

  it('keeps the developed target capped', () => {
    expect(nextGrowthThreshold(0)).toBe(60);
    expect(nextGrowthThreshold(4)).toBe(640);
  });

  it('describes visible progress without changing growth thresholds', () => {
    expect(growthProgressForXp(155)).toEqual({
      currentStage: 2,
      isFinalStage: false,
      nextStage: 3,
      ratio: 0.175,
      remainingXp: 165,
      targetXp: 320,
    });
    expect(growthProgressForXp(700)).toEqual({
      currentStage: 4,
      isFinalStage: true,
      nextStage: null,
      ratio: 1,
      remainingXp: 0,
      targetXp: 640,
    });
  });

  it('never promises a stage transition before the guaranteed session XP reaches it', () => {
    expect(estimatedBrushingsToNextStage(40)).toBe(2);
    expect(estimatedBrushingsToNextStage(50)).toBe(1);
    expect(growthStageForXp(50 + 10)).toBe(1);
    expect(estimatedBrushingsToNextStage(110)).toBe(1);
    expect(growthStageForXp(110 + 10)).toBe(2);
    expect(estimatedBrushingsToNextStage(640)).toBe(0);
  });
});
