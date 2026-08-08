import { BRUSHING_SEGMENT_COUNT, BRUSHING_SEGMENT_SECONDS, BRUSHING_TOTAL_SECONDS } from './time';

export type BrushingTimerState = Readonly<{
  status: 'running' | 'paused';
  startedAtMs: number;
  pausedAtMs: number | null;
  pausedDurationMs: number;
}>;

export type BrushingTimerSnapshot = Readonly<{
  elapsedSeconds: number;
  remainingSeconds: number;
  segmentIndex: number;
  segmentRemainingSeconds: number;
  completed: boolean;
}>;

export function startBrushingTimer(nowMs: number): BrushingTimerState {
  return { status: 'running', startedAtMs: nowMs, pausedAtMs: null, pausedDurationMs: 0 };
}

export function pauseBrushingTimer(state: BrushingTimerState, nowMs: number): BrushingTimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', pausedAtMs: nowMs };
}

export function resumeBrushingTimer(state: BrushingTimerState, nowMs: number): BrushingTimerState {
  if (state.status !== 'paused' || state.pausedAtMs === null) return state;
  return {
    ...state,
    status: 'running',
    pausedAtMs: null,
    pausedDurationMs: state.pausedDurationMs + Math.max(0, nowMs - state.pausedAtMs),
  };
}

export function getBrushingTimerSnapshot(
  state: BrushingTimerState,
  nowMs: number,
): BrushingTimerSnapshot {
  const effectiveNow = state.status === 'paused' ? (state.pausedAtMs ?? nowMs) : nowMs;
  const elapsedMs = Math.max(0, effectiveNow - state.startedAtMs - state.pausedDurationMs);
  const elapsedSeconds = Math.min(BRUSHING_TOTAL_SECONDS, Math.floor(elapsedMs / 1000));
  const completed = elapsedSeconds >= BRUSHING_TOTAL_SECONDS;
  const segmentIndex = Math.min(
    BRUSHING_SEGMENT_COUNT - 1,
    Math.floor(elapsedSeconds / BRUSHING_SEGMENT_SECONDS),
  );
  const segmentElapsed = elapsedSeconds - segmentIndex * BRUSHING_SEGMENT_SECONDS;
  return {
    elapsedSeconds,
    remainingSeconds: Math.max(0, BRUSHING_TOTAL_SECONDS - elapsedSeconds),
    segmentIndex,
    segmentRemainingSeconds: completed ? 0 : BRUSHING_SEGMENT_SECONDS - segmentElapsed,
    completed,
  };
}
