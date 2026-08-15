import {
  TIMER_TICK_LATE_TOLERANCE_MS,
  nextAlignedTickBoundary,
  shouldEmitAlignedTick,
} from '../timerTick';

describe('monotonic countdown tick scheduling', () => {
  it('anchors every deadline to an exact elapsed-time second boundary', () => {
    const start = 10_000;
    const deadlines = Array.from({ length: 20 }, (_, index) =>
      nextAlignedTickBoundary({
        nowWallTimeMs: start + index * 1000 + 12,
        pausedDurationMs: 0,
        startedAtMs: start,
      }),
    );
    expect(deadlines.map(({ targetWallTimeMs }) => targetWallTimeMs)).toEqual(
      Array.from({ length: 20 }, (_, index) => start + (index + 1) * 1000),
    );
  });

  it('resumes on the next logical timer boundary without resetting the grid', () => {
    expect(
      nextAlignedTickBoundary({
        nowWallTimeMs: 25_300,
        pausedDurationMs: 5000,
        startedAtMs: 10_000,
      }),
    ).toEqual({ boundarySecond: 11, delayMs: 700, targetWallTimeMs: 26_000 });
  });

  it('drops late callbacks instead of compressing missed ticks', () => {
    expect(
      shouldEmitAlignedTick({
        boundarySecond: 4,
        lateByMs: TIMER_TICK_LATE_TOLERANCE_MS + 1,
        totalSeconds: 120,
        voiceGuidanceEnabled: false,
        voiceSpeaking: false,
      }),
    ).toBe(false);
  });

  it('mutes quadrant voice boundaries and returns to the unchanged second grid', () => {
    expect(
      [29, 30, 31].map((boundarySecond) =>
        shouldEmitAlignedTick({
          boundarySecond,
          lateByMs: 2,
          totalSeconds: 120,
          voiceGuidanceEnabled: true,
          voiceSpeaking: false,
        }),
      ),
    ).toEqual([true, false, true]);
  });

  it('allows the final boundary tick but nothing after completion', () => {
    const decision = (boundarySecond: number) =>
      shouldEmitAlignedTick({
        boundarySecond,
        lateByMs: 1,
        totalSeconds: 120,
        voiceGuidanceEnabled: false,
        voiceSpeaking: false,
      });
    expect(decision(120)).toBe(true);
    expect(decision(121)).toBe(false);
  });
});
