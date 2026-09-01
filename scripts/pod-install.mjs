#!/usr/bin/env node
/**
 * Runs `bundle exec pod install` after every dependency install so the native
 * iOS Pods project never drifts out of sync with `node_modules`.
 *
 * Why this exists: `expo-sqlite`'s podspec copies its vendored `sqlite3.c` /
 * `sqlite3.h` (the `exsqlite3_*` amalgamation) into
 * `node_modules/expo-sqlite/ios/` at `pod install` time. Those files are NOT in
 * the npm tarball, so every `npm install` / `pnpm install` deletes them. Without
 * a follow-up `pod install`, Xcode then builds `SQLiteModule.swift` against a
 * missing header and fails with dozens of "Cannot find 'exsqlite3_...' in
 * scope" errors. Re-running `pod install` here restores them automatically.
 *
 * Safe by design: only acts on macOS with an `ios/Podfile`, never fails the
 * install (a pod problem prints a loud warning and exits 0), and can be skipped
 * with `SKIP_POD_INSTALL=1`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const iosDir = join(repoRoot, 'ios');

const skip = (reason) => {
  console.log(`[pod-install] skipped — ${reason}`);
  process.exit(0);
};

if (process.env.SKIP_POD_INSTALL === '1') skip('SKIP_POD_INSTALL=1');
if (process.platform !== 'darwin') skip(`not macOS (${process.platform})`);
if (!existsSync(join(iosDir, 'Podfile'))) skip('no ios/Podfile (managed / pre-prebuild)');

const hasBundler = spawnSync('bundle', ['--version'], { stdio: 'ignore' }).status === 0;
if (!hasBundler) {
  skip("Bundler not found — run `gem install bundler && bundle install`, then `bundle exec pod install`");
}

console.log('[pod-install] bundle exec pod install (ios/) …');
try {
  execFileSync('bundle', ['exec', 'pod', 'install'], {
    cwd: iosDir,
    stdio: 'inherit',
    env: { ...process.env, LANG: process.env.LANG || 'en_US.UTF-8' },
  });
  console.log('[pod-install] done — iOS Pods are in sync.');
} catch (error) {
  console.warn(
    '\n[pod-install] WARNING: `pod install` failed. The iOS build may fail with ' +
      '"Cannot find \'exsqlite3_...\' in scope" until you run:\n' +
      '  cd ios && bundle exec pod install\n' +
      `(${error?.message ?? error})\n`,
  );
  process.exit(0);
}
