/* [DIAG] TEMPORARY on-device trace sink for the "stuck on Hazırlanıyor"
 * investigation. Appends NDJSON to <Documents>/trace-debug.log, pulled with
 * `xcrun devicectl device copy from`. Delete this file and its call sites once
 * the root cause is confirmed. */
import * as FileSystem from 'expo-file-system/legacy';

const LOG_PATH = `${FileSystem.documentDirectory ?? ''}trace-debug.log`;
const MAX_BYTES = 300_000;

let queue: Promise<void> = Promise.resolve();

export function trace(tag: string, data?: unknown): void {
  let payload = '';
  if (data !== undefined) {
    try {
      payload = ' ' + JSON.stringify(data);
    } catch {
      payload = ' ' + String(data);
    }
  }
  try {
    console.log(`[[TRACE]] ${tag}${payload}`);
  } catch {
    // ignore
  }
  if (!FileSystem.documentDirectory) return;
  const line = `${new Date().toISOString()} ${tag}${payload}\n`;
  queue = queue
    .then(async () => {
      let prev = '';
      try {
        prev = await FileSystem.readAsStringAsync(LOG_PATH);
      } catch {
        prev = '';
      }
      if (prev.length > MAX_BYTES) prev = prev.slice(prev.length - MAX_BYTES);
      await FileSystem.writeAsStringAsync(LOG_PATH, prev + line);
    })
    .catch(() => {});
}

export function traceErr(tag: string, err: unknown): void {
  trace(tag, {
    message: (err as Error)?.message ?? String(err),
    name: (err as Error)?.name,
    stack: String((err as Error)?.stack ?? '')
      .split('\n')
      .slice(0, 10),
  });
}

// [DIAG] self-installing global handlers so ANY uncaught error / rejection is
// captured even if some layer swallows it.
declare const global: {
  ErrorUtils?: {
    getGlobalHandler?: () => ((e: unknown, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (h: (e: unknown, isFatal?: boolean) => void) => void;
  };
  __traceHandlersInstalled?: boolean;
};

if (typeof global !== 'undefined' && !global.__traceHandlersInstalled) {
  global.__traceHandlersInstalled = true;
  try {
    const prev = global.ErrorUtils?.getGlobalHandler?.();
    global.ErrorUtils?.setGlobalHandler?.((e, isFatal) => {
      traceErr(`GLOBAL_ERROR${isFatal ? '/FATAL' : ''}`, e);
      prev?.(e, isFatal);
    });
  } catch {
    // ignore
  }
}
