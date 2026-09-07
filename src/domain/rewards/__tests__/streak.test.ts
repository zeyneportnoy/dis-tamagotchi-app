import { deriveStreak, nextFullDayStreak, previousLocalDayKey } from '../streak';

describe('daily streak rules', () => {
  it('increments a consecutive completed day and starts at one after a gap', () => {
    expect(nextFullDayStreak(4)).toBe(5);
    expect(nextFullDayStreak(null)).toBe(1);
  });

  it('calculates the previous calendar key without rewriting stored day keys', () => {
    expect(previousLocalDayKey('2026-03-01')).toBe('2026-02-28');
    expect(previousLocalDayKey('2028-03-01')).toBe('2028-02-29');
  });
});

describe('deriveStreak — deterministic from the set of full-day dates', () => {
  it('is 0 with no full-day history', () => {
    expect(deriveStreak([], '2026-09-07')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(deriveStreak(['2026-09-05', '2026-09-06', '2026-09-07'], '2026-09-07')).toBe(3);
  });

  it('still counts when the most recent full day is yesterday (streak not yet broken)', () => {
    expect(deriveStreak(['2026-09-05', '2026-09-06'], '2026-09-07')).toBe(2);
  });

  it('is 0 once a whole calendar day has passed with no full day', () => {
    expect(deriveStreak(['2026-09-04', '2026-09-05'], '2026-09-07')).toBe(0);
  });

  it('only counts the trailing consecutive run, ignoring an earlier island', () => {
    expect(
      deriveStreak(['2026-08-01', '2026-09-05', '2026-09-06', '2026-09-07'], '2026-09-07'),
    ).toBe(3);
  });

  it('is order- and duplicate-independent (a set, not a session count)', () => {
    expect(
      deriveStreak(
        ['2026-09-07', '2026-09-05', '2026-09-07', '2026-09-06', '2026-09-06'],
        '2026-09-07',
      ),
    ).toBe(3);
  });

  it('crosses a month boundary correctly', () => {
    expect(deriveStreak(['2026-08-31', '2026-09-01'], '2026-09-01')).toBe(2);
  });
});
