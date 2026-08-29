import {
  BRUSHING_SEGMENT_COUNT,
  BRUSHING_SEGMENT_SECONDS,
  BRUSHING_TOTAL_SECONDS,
  closedBrushingSlotsSince,
  determineBrushingPeriod,
  getBrushingTimerSnapshot,
  pauseBrushingTimer,
  resumeBrushingTimer,
  startBrushingTimer,
} from '../index';

describe('brushing timer', () => {
  it('defines a 120-second session split into four 30-second segments', () => {
    expect(BRUSHING_TOTAL_SECONDS).toBe(120);
    expect(BRUSHING_SEGMENT_COUNT).toBe(4);
    expect(BRUSHING_SEGMENT_SECONDS).toBe(30);
  });

  it.each([
    [0, 0, 120],
    [29_999, 0, 91],
    [30_000, 1, 90],
    [60_000, 2, 60],
    [90_000, 3, 30],
    [120_000, 3, 0],
  ])('moves to the correct segment at %i ms', (nowMs, segmentIndex, remainingSeconds) => {
    const snapshot = getBrushingTimerSnapshot(startBrushingTimer(0), nowMs);
    expect(snapshot.segmentIndex).toBe(segmentIndex);
    expect(snapshot.remainingSeconds).toBe(remainingSeconds);
    expect(snapshot.completed).toBe(nowMs === 120_000);
  });

  it('does not advance while paused and resumes from the same elapsed time', () => {
    const paused = pauseBrushingTimer(startBrushingTimer(0), 10_000);
    expect(getBrushingTimerSnapshot(paused, 40_000).elapsedSeconds).toBe(10);
    const resumed = resumeBrushingTimer(paused, 40_000);
    expect(getBrushingTimerSnapshot(resumed, 50_000).elapsedSeconds).toBe(20);
  });

  it('classifies only the fixed morning and evening main-slot boundaries', () => {
    expect(determineBrushingPeriod(new Date(2026, 7, 8, 4))).toBe('morning');
    expect(determineBrushingPeriod(new Date(2026, 7, 8, 11, 59, 59))).toBe('morning');
    expect(determineBrushingPeriod(new Date(2026, 7, 8, 12))).toBeNull();
    expect(determineBrushingPeriod(new Date(2026, 7, 8, 17, 59, 59))).toBeNull();
    expect(determineBrushingPeriod(new Date(2026, 7, 8, 18))).toBe('evening');
    expect(determineBrushingPeriod(new Date(2026, 7, 8, 23, 59, 59))).toBe('evening');
    expect(determineBrushingPeriod(new Date(2026, 7, 9, 0))).toBeNull();
    expect(determineBrushingPeriod(new Date(2026, 7, 9, 3, 59, 59))).toBeNull();
  });

  it('returns only closed slots that end after profile creation', () => {
    const slots = closedBrushingSlotsSince(new Date(2026, 7, 8, 13), new Date(2026, 7, 9, 12));
    expect(slots.map(({ localDayKey, period }) => `${localDayKey}:${period}`)).toEqual([
      '2026-08-08:evening',
      '2026-08-09:morning',
    ]);
  });
});
