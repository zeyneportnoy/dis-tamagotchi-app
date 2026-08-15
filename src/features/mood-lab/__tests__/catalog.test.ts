import {
  moodLabCharacters,
  moodLabCombinationCount,
  moodLabMoods,
  moodLabStages,
} from '../catalog';

describe('development Mood Lab catalog', () => {
  it('exposes all 8 × 5 × 7 preview combinations without persistence', () => {
    expect(moodLabCharacters).toHaveLength(8);
    expect(moodLabStages).toHaveLength(5);
    expect(moodLabMoods).toHaveLength(7);
    expect(moodLabCombinationCount).toBe(280);
  });
});
