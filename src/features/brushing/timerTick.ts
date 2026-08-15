export const TIMER_TICK_LATE_TOLERANCE_MS = 120;

export type AlignedTickBoundary = Readonly<{
  boundarySecond: number;
  delayMs: number;
  targetWallTimeMs: number;
}>;

export function nextAlignedTickBoundary(input: {
  nowWallTimeMs: number;
  pausedDurationMs: number;
  startedAtMs: number;
}): AlignedTickBoundary {
  const elapsedMs = Math.max(0, input.nowWallTimeMs - input.startedAtMs - input.pausedDurationMs);
  const boundarySecond = Math.floor(elapsedMs / 1000) + 1;
  const targetWallTimeMs = input.startedAtMs + input.pausedDurationMs + boundarySecond * 1000;
  return {
    boundarySecond,
    delayMs: Math.max(0, targetWallTimeMs - input.nowWallTimeMs),
    targetWallTimeMs,
  };
}

export function shouldEmitAlignedTick(input: {
  boundarySecond: number;
  lateByMs: number;
  totalSeconds: number;
  voiceGuidanceEnabled: boolean;
  voiceSpeaking: boolean;
}): boolean {
  const isVoiceBoundary =
    input.voiceGuidanceEnabled &&
    input.boundarySecond < input.totalSeconds &&
    input.boundarySecond % 30 === 0;
  return (
    input.boundarySecond <= input.totalSeconds &&
    input.lateByMs <= TIMER_TICK_LATE_TOLERANCE_MS &&
    !input.voiceSpeaking &&
    !isVoiceBoundary
  );
}
