import { nextFullDayStreak, previousLocalDayKey } from '../streak';

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
