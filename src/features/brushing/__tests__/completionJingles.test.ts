import {
  chooseCompletionJingleIndex,
  completionJingles,
  resetCompletionJingleSelectionForTests,
} from '../completionJingles';

describe('completion jingle pool', () => {
  beforeEach(resetCompletionJingleSelectionForTests);

  it('contains six separately addressed success sounds', () => {
    expect(completionJingles).toHaveLength(6);
    expect(new Set(completionJingles.map(({ path }) => path)).size).toBe(6);
  });

  it('does not repeat either of the last two sounds', () => {
    expect(chooseCompletionJingleIndex(0)).toBe(0);
    expect(chooseCompletionJingleIndex(0)).toBe(1);
    expect(chooseCompletionJingleIndex(0)).toBe(2);
    expect(chooseCompletionJingleIndex(0)).toBe(0);
  });

  it('simulates six runtime completions with distinct assets', () => {
    const picks = [0.02, 0.31, 0.62, 0.93, 0.15, 0.74].map(chooseCompletionJingleIndex);
    expect(
      picks.every((pick, index) => index < 2 || !picks.slice(index - 2, index).includes(pick)),
    ).toBe(true);
    expect(picks.map((index) => completionJingles[index]?.path)).toHaveLength(6);
  });
});
