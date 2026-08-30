/**
 * DEV-only boot / route latency instrumentation.
 *
 * No-ops in production and under Jest. Emits monotonic `performance.now()`
 * timings so the real cost of the startup path can be measured on a physical
 * device (Metro logs / Flipper / `npx react-native log-ios`).
 *
 * Usage:
 *   perfMark('bootstrap:start');
 *   await perfStep('bootstrap:recoverFromCloud', () => recoverFromCloud());
 *   perfSince('bootstrap:route-decided', 'bootstrap:start');
 */

const clock = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const ENABLED = __DEV__ && process.env.NODE_ENV !== 'test';

/** Approx. "JS app start" — first evaluation of this module, very early in boot. */
const APP_START = clock();

const marks = new Map<string, number>();

export function perfMark(label: string): void {
  if (!ENABLED) return;
  const at = clock();
  marks.set(label, at);
  console.log(`⏱ [perf] ${label} @ ${(at - APP_START).toFixed(0)}ms`);
}

export function perfSince(label: string, startLabel: string): void {
  if (!ENABLED) return;
  const at = clock();
  const start = marks.get(startLabel);
  if (start == null) {
    perfMark(label);
    return;
  }
  console.log(
    `⏱ [perf] ${label} +${(at - start).toFixed(0)}ms (@ ${(at - APP_START).toFixed(0)}ms)`,
  );
}

/** Wrap an async step: logs its start offset and its duration. */
export async function perfStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!ENABLED) return fn();
  const start = clock();
  console.log(`⏱ [perf] ${label} …start (@ ${(start - APP_START).toFixed(0)}ms)`);
  try {
    return await fn();
  } finally {
    console.log(`⏱ [perf] ${label} …end +${(clock() - start).toFixed(0)}ms`);
  }
}
