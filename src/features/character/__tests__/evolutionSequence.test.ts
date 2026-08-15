import { evolutionSequence } from '../evolutionSequence';

describe('character evolution sequence', () => {
  it('reveals egg cracks progressively and holds the cracking stage', () => {
    expect(evolutionSequence(0, 1)).toEqual([
      { growthStage: 0, phase: 'resting' },
      { growthStage: 0, phase: 'crack-start' },
      { growthStage: 0, phase: 'cracking' },
      { growthStage: 1, phase: 'resting' },
    ]);
  });

  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
  ] as const)('moves once from stage %i to stage %i and holds the new stage', (from, to) => {
    expect(evolutionSequence(from, to)).toEqual([
      { growthStage: from, phase: 'resting' },
      { growthStage: to, phase: 'resting' },
    ]);
  });
});
