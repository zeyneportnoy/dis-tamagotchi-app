import AsyncStorage from '@react-native-async-storage/async-storage';

import { getParentAuthUseCases } from '@/application/auth';
import { getSupabaseClient } from '@/data/auth';
import { getDatabase } from '@/data/db';
import type { AuthoritativeProgress, ChildReminderPatch } from '@/domain/sync';
import {
  SQLiteChildCloudSyncRepository,
  SQLiteChildPreferenceSyncRepository,
  SQLiteProfileSyncRepository,
  SupabaseChildDataRepository,
  SupabaseChildPreferencesRepository,
  SupabaseChildProfileRepository,
} from '@/data/repositories';
import {
  getBrushingVoiceProfile,
  getNicknamePersonalizationEnabled,
  hasStoredNicknamePersonalization,
  hasStoredVoiceProfile,
  markNicknamePersonalizationSynced,
  markVoiceProfileSynced,
  readNicknamePersonalizationSyncMeta,
  readVoiceProfileSyncMeta,
  setBrushingVoiceProfile,
  setNicknamePersonalizationEnabled,
} from '@/features/brushing';
import {
  dentistReminderService,
  dentistVisitService,
  reminderSettingsService,
  syncGroupedBrushingReminders,
} from '@/features/reminders';

import { ChildDataSyncUseCases } from './ChildDataSyncUseCases';
import {
  ChildPreferencesSyncUseCases,
  type ChildPreferenceAccessors,
} from './ChildPreferencesSyncUseCases';
import { ProfileSyncUseCases } from './ProfileSyncUseCases';

let useCasesPromise: Promise<ProfileSyncUseCases | null> | undefined;
let childDataSyncPromise: Promise<ChildDataSyncUseCases | null> | undefined;
let childPreferencesSyncPromise: Promise<ChildPreferencesSyncUseCases | null> | undefined;
let childDataRecoveryPromise: Promise<void> | null = null;
let childPreferencesRecoveryPromise: Promise<void> | null = null;
// Refresh (re-pull) bookkeeping — distinct from the once-per-session recovery
// gate above. Lets an already-open device learn about a brushing another
// device completed while this one stayed foregrounded.
let childDataRefreshInFlight: Promise<void> | null = null;
let childDataRefreshedAtMs = 0;
const CHILD_DATA_REFRESH_MIN_INTERVAL_MS = 10_000;

const childPreferenceAccessors: ChildPreferenceAccessors = {
  readVoice: (parentUserId, childProfileId) =>
    getBrushingVoiceProfile(parentUserId, childProfileId),
  hasStoredVoice: (parentUserId, childProfileId) =>
    hasStoredVoiceProfile(parentUserId, childProfileId),
  writeVoice: (parentUserId, childProfileId, voice) =>
    setBrushingVoiceProfile(parentUserId, childProfileId, voice),
  markVoiceSynced: (parentUserId, childProfileId, voice) =>
    markVoiceProfileSynced(parentUserId, childProfileId, voice),
  readVoiceSyncMeta: (parentUserId, childProfileId) =>
    readVoiceProfileSyncMeta(parentUserId, childProfileId),
  async readReminders(parentUserId, childProfileId) {
    const settings = await reminderSettingsService.get(parentUserId, childProfileId);
    return {
      morning: { enabled: settings.morning.enabled, time: settings.morning.time },
      evening: { enabled: settings.evening.enabled, time: settings.evening.time },
    };
  },
  hasStoredReminders: (parentUserId, childProfileId) =>
    reminderSettingsService.hasStoredSettings(parentUserId, childProfileId),
  applyRecoveredReminders: (parentUserId, childProfileId, values) =>
    reminderSettingsService.applyRecoveredPreferences(parentUserId, childProfileId, values),
  markRemindersSynced: (parentUserId, childProfileId) =>
    reminderSettingsService.markSynced(parentUserId, childProfileId),
  readRemindersSyncMeta: (parentUserId, childProfileId) =>
    reminderSettingsService.readSyncMeta(parentUserId, childProfileId),
  async applyRecoveredDentist(childProfileId, nickname, values) {
    const child = { id: childProfileId, nickname };
    await dentistVisitService.applyRecovered(child, values);
    // Mirrors onboarding/summary.tsx's own either/or exactly: the generic
    // +6/+12-month fallback reminder is only ever scheduled for a child who
    // has NO real last-visit date (otherwise the specific routine reminder
    // above already covers it). This device has just created the
    // dentist_reminders row (via applyRecovered -> ensureRow) with due dates
    // anchored to the child's real created_at, so re-establishing the
    // fallback notification here reproduces exactly what onboarding did on
    // the originating device — never a second, redundant reminder.
    if (!values.lastVisitDate) {
      await dentistReminderService.ensureScheduledForProfile(child).catch(() => undefined);
    }
  },
  readNicknamePersonalization: (parentUserId, childProfileId) =>
    getNicknamePersonalizationEnabled(parentUserId, childProfileId),
  hasStoredNicknamePersonalization: (parentUserId, childProfileId) =>
    hasStoredNicknamePersonalization(parentUserId, childProfileId),
  writeNicknamePersonalization: (parentUserId, childProfileId, enabled) =>
    setNicknamePersonalizationEnabled(parentUserId, childProfileId, enabled),
  markNicknamePersonalizationSynced: (parentUserId, childProfileId, enabled) =>
    markNicknamePersonalizationSynced(parentUserId, childProfileId, enabled),
  readNicknamePersonalizationSyncMeta: (parentUserId, childProfileId) =>
    readNicknamePersonalizationSyncMeta(parentUserId, childProfileId),
};

export function getProfileSyncUseCases(): Promise<ProfileSyncUseCases | null> {
  useCasesPromise ??= getDatabase().then((database) => {
    const client = getSupabaseClient();
    return client
      ? new ProfileSyncUseCases(
          new SQLiteProfileSyncRepository(database),
          new SupabaseChildProfileRepository(client),
        )
      : null;
  });
  return useCasesPromise;
}

/**
 * Push every locally `pending` / `failed` / legacy child profile to Supabase
 * (create or update via upsert on `id`). Fire-and-forget by design: the local
 * SQLite write is the offline-first success boundary, so a missing session or a
 * network/Supabase failure is swallowed here and retried on the next call or on
 * `recoverFromCloud()` at the next app start.
 */
export async function pushPendingChildProfiles(): Promise<void> {
  try {
    const session = await getParentAuthUseCases()?.getSession();
    if (!session) return;
    const sync = await getProfileSyncUseCases();
    await sync?.claimLegacyProfiles(session.userId);
    // Propagate any queued child archive/delete to the owner's own cloud rows.
    await sync?.flushPendingRemovals(session.userId);
  } catch {
    // Swallowed: cloud sync is best-effort in this phase.
  }
}

export function getChildDataSyncUseCases(): Promise<ChildDataSyncUseCases | null> {
  childDataSyncPromise ??= getDatabase().then((database) => {
    const client = getSupabaseClient();
    return client
      ? new ChildDataSyncUseCases(
          new SQLiteChildCloudSyncRepository(database),
          new SupabaseChildDataRepository(client),
        )
      : null;
  });
  return childDataSyncPromise;
}

// Skip a redundant push when a screen-focus getProgress() reports an unchanged
// value; the durable "is dirty?" check lives in the SQLite sync markers.
const lastPushedProgress = new Map<string, string>();

/**
 * Called on logout: drops in-memory, session-scoped sync bookkeeping so nothing
 * from the previous account leaks into the next one. Persistent offline data
 * (local SQLite rows, AsyncStorage keyed by parent id) is left untouched so the
 * original parent's data returns on re-login.
 */
export function resetSessionSyncState(): void {
  lastPushedProgress.clear();
  childDataRecoveryPromise = null;
  childPreferencesRecoveryPromise = null;
  childDataRefreshInFlight = null;
  childDataRefreshedAtMs = 0;
}

/**
 * Called after a confirmed account deletion: removes this parent's local data so
 * nothing survives on the device. DB rows cascade from `child_profiles`;
 * AsyncStorage keys scoped to the parent (voice / reminders / nickname prefs)
 * and to each of its children (customization) are swept too.
 */
export async function wipeLocalAccountData(parentUserId: string): Promise<void> {
  try {
    lastPushedProgress.clear();
    const database = await getDatabase();
    const childRows = await database.getAllAsync<{ id: string }>(
      `SELECT id FROM child_profiles WHERE parent_auth_user_id = ?`,
      parentUserId,
    );
    await database.runAsync(
      `DELETE FROM child_profiles WHERE parent_auth_user_id = ?`,
      parentUserId,
    );

    const allKeys = await AsyncStorage.getAllKeys();
    const childIds = new Set(childRows.map((row) => row.id));
    const doomed = allKeys.filter(
      (key) =>
        key.includes(`.parent.${parentUserId}.`) ||
        key.startsWith(`parent:${parentUserId}:`) ||
        [...childIds].some((id) => key.startsWith(`customization.profile.${id}`)),
    );
    if (doomed.length > 0) await AsyncStorage.multiRemove(doomed);
  } catch {
    // Best-effort local cleanup; the cloud account is already gone.
  }
}

/**
 * Fire-and-forget flush of a child's pending cloud writes: each unsynced
 * completed slot is presented to the atomic server reward claim, each missed
 * slot to the atomic penalty, and the authoritative score/streak they return is
 * written back into the local cache. NO absolute progress is ever pushed.
 * `snapshot` lets callers skip a redundant call when nothing changed. Every
 * failure is swallowed; the local SQLite sync markers keep the backlog for the
 * next retry. Local data is never rolled back here.
 */
export async function syncChildCloudProgress(
  profileId: string,
  snapshot?: Readonly<{ totalXp: number; currentStreak: number }>,
): Promise<void> {
  const marker = snapshot ? `${snapshot.totalXp}:${snapshot.currentStreak}` : null;
  if (marker && lastPushedProgress.get(profileId) === marker) return;
  if (marker) lastPushedProgress.set(profileId, marker);
  try {
    const sync = await getChildDataSyncUseCases();
    if (!sync) return;
    await sync.pushChild(profileId);
  } catch {
    if (marker) lastPushedProgress.delete(profileId);
  }
}

/**
 * Fire-and-forget flush after a brushing session finishes: presents the new
 * completed slot to the atomic server reward claim (idempotent on the stable
 * session id AND on `(child, day, period)`, so a retry or a second device never
 * earns a second +20) and writes the authoritative score/streak it returns into
 * the local cache.
 */
export async function syncChildBrushingSession(
  profileId: string,
  sessionId: string,
): Promise<AuthoritativeProgress | null> {
  try {
    const sync = await getChildDataSyncUseCases();
    if (!sync) return null;
    const claims = await sync.pushChild(profileId);
    return claims.get(sessionId) ?? null;
  } catch {
    // Swallowed: local session + reward already committed; the next
    // retryPendingCloudSync() reconciles it against the server.
    return null;
  }
}

/**
 * On app/session restore (and every foreground / focus / profile-switch
 * refresh): PULL the authoritative Mine Puan progress for every owned child
 * from the cloud into the local cache. The cloud row always wins — a local row
 * that is stale, dirty, defaulted to 0 or unhydrated is overwritten, never
 * pushed. This is pull-only; there is no path back to an absolute cloud write.
 */
export async function recoverChildCloudProgress(): Promise<void> {
  try {
    const sync = await getChildDataSyncUseCases();
    await sync?.recoverProgress();
  } catch {
    // Swallowed: local data (if any) stays intact.
  }
}

/**
 * On fresh install: hydrate brushing session + slot evaluation history from the
 * cloud so the Görevler/Takvim history is not empty. Idempotent — never
 * duplicates a row and never re-applies a reward/penalty. Must run before the
 * first getProgress()/reconcile so hydrated evaluations block a second -10.
 */
export async function recoverChildBrushingHistory(): Promise<void> {
  try {
    const sync = await getChildDataSyncUseCases();
    await sync?.recoverBrushingHistory();
  } catch {
    // Swallowed: local data (if any) stays intact.
  }
}

/**
 * Runs Mine Puan progress recovery and brushing/evaluation history recovery
 * exactly once per signed-in app session, and hands every caller the SAME
 * in-flight/resolved promise instead of letting them race independent copies
 * of the same work.
 *
 * This matters because missed-slot reconciliation (`ChildExperienceUseCases
 * .getProgress` → `reconcileMissedSlots`, driven by `MissedSlotReconciler` in
 * the root layout as well as every screen that reads progress) must never run
 * against local `brushing_sessions` / `daily_progress` tables that have not
 * been hydrated from the cloud yet on this device. An unhydrated table looks
 * exactly like a wall of missed slots: reconciliation applies a real -10
 * penalty for every closed slot since the profile was created, which can
 * crash a genuinely-progressing child's score to the 0 floor the moment a
 * device is reinstalled, a cold start races the recovery pass, or a second
 * device opens the app before the first device's history has synced.
 * Awaiting this gate before reconciling guarantees history is hydrated first.
 */
export function ensureChildDataRecovered(): Promise<void> {
  childDataRecoveryPromise ??= (async () => {
    await recoverChildCloudProgress();
    await recoverChildBrushingHistory();
    // The first full recovery counts as the most recent refresh, so the very
    // next getProgress() does not immediately re-pull the same data.
    childDataRefreshedAtMs = Date.now();
  })();
  return childDataRecoveryPromise;
}

/**
 * Re-pull authoritative Mine Puan progress + brushing/evaluation history from
 * the cloud for a session whose first recovery has ALREADY completed. This is
 * how a device that stayed open (foreground, Home re-focus, active-profile
 * switch) learns about a brushing another device completed in the meantime —
 * `ensureChildDataRecovered()` is memoised once per session and never re-pulls.
 *
 * Ordering is preserved: it awaits the one-time recovery gate first, then runs
 * the SAME steps in the SAME order (progress, then history), so missed-slot
 * reconciliation still never sees an unhydrated table. Every write underneath
 * is a conflict-safe newer-wins upsert / idempotent `INSERT OR IGNORE`, so
 * repeated calls never duplicate a row or re-run a reward or penalty.
 *
 * Coalesced (concurrent callers share one in-flight pull) and throttled to at
 * most once per `CHILD_DATA_REFRESH_MIN_INTERVAL_MS`; `force: true` (foreground,
 * profile switch) bypasses only the throttle, never the ordering gate.
 */
export async function refreshChildCloudData(options?: { force?: boolean }): Promise<void> {
  await ensureChildDataRecovered();
  if (childDataRefreshInFlight) return childDataRefreshInFlight;
  if (!options?.force && Date.now() - childDataRefreshedAtMs < CHILD_DATA_REFRESH_MIN_INTERVAL_MS) {
    return;
  }
  childDataRefreshInFlight = (async () => {
    try {
      await recoverChildCloudProgress();
      await recoverChildBrushingHistory();
      childDataRefreshedAtMs = Date.now();
    } finally {
      childDataRefreshInFlight = null;
    }
  })();
  return childDataRefreshInFlight;
}

/**
 * Retry every locally pending cloud write (child profiles first, then dependent
 * progress / sessions / evaluations / preferences). Triggered on bootstrap and
 * when the app returns to the foreground — not polled. Idempotent upserts, so a
 * child that is not cloud-synced yet is simply skipped until it is.
 */
export async function retryPendingCloudSync(): Promise<void> {
  try {
    await pushPendingChildProfiles();
    const sync = await getChildDataSyncUseCases();
    await sync?.pushAllPending();
    await syncAllChildPreferences();
  } catch {
    // Swallowed: retried again on the next trigger.
  }
}

export function getChildPreferencesSyncUseCases(): Promise<ChildPreferencesSyncUseCases | null> {
  childPreferencesSyncPromise ??= getDatabase().then((database) => {
    const client = getSupabaseClient();
    return client
      ? new ChildPreferencesSyncUseCases(
          new SQLiteChildPreferenceSyncRepository(database),
          new SupabaseChildPreferencesRepository(client),
          childPreferenceAccessors,
        )
      : null;
  });
  return childPreferencesSyncPromise;
}

/**
 * Fire-and-forget push of one child's customization + preference snapshot after
 * a local write. The local write is the source of truth; a cloud failure is
 * swallowed and never rolls back the selection.
 */
export async function syncChildPreferences(profileId: string): Promise<void> {
  try {
    await ensureChildPreferencesRecovered();
    const sync = await getChildPreferencesSyncUseCases();
    await sync?.pushForProfile(profileId);
  } catch {
    // Swallowed: local preference already saved.
  }
}

/**
 * Fire-and-forget push for every synced child. Used when a per-parent preference
 * (voice guide) changes, since it applies to all children.
 *
 * NOTE: this no longer carries reminder times. The whole-row snapshot it pushes
 * excludes the four reminder columns (no client write grant — migration m11), so
 * a foreground `retryPendingCloudSync()` can never rebuild an ambient
 * `defaultReminderSettings` (08:00 / 20:30) over a real custom time. Genuine
 * reminder edits go through `syncChildReminders()` below.
 */
export async function syncAllChildPreferences(): Promise<void> {
  try {
    await ensureChildPreferencesRecovered();
    const sync = await getChildPreferencesSyncUseCases();
    await sync?.pushForAllSyncedChildren();
  } catch {
    // Swallowed: local preference already saved.
  }
}

/**
 * Fire-and-forget field-scoped push of ONE genuine parent reminder edit for one
 * child. Called only from the reminder settings screen and onboarding finish —
 * after the local `ReminderSettingsService` write that is the source of truth —
 * never from recovery / bootstrap / foreground. `patch` holds only the reminder
 * key(s) that actually changed, with the exact chosen value.
 */
export async function syncChildReminders(
  childProfileId: string,
  patch: ChildReminderPatch,
): Promise<void> {
  try {
    const sync = await getChildPreferencesSyncUseCases();
    await sync?.pushReminderEdit(childProfileId, patch);
  } catch {
    // Swallowed: the local reminder record is already saved and authoritative;
    // the cloud patch retries on the next reminder edit.
  }
}

/**
 * On app/session restore: hydrate cloud customization + per-parent preferences
 * into local storage only where nothing is stored locally yet. Locked cloud
 * selections stay governed by the existing render-time unlock guards.
 */
export async function recoverChildPreferences(): Promise<void> {
  try {
    const sync = await getChildPreferencesSyncUseCases();
    await sync?.recover();
    const session = await getParentAuthUseCases()?.getSession();
    if (!session) return;
    const database = await getDatabase();
    const children = await database.getAllAsync<{ id: string; nickname: string }>(
      `SELECT id, nickname FROM child_profiles
       WHERE parent_auth_user_id = ? AND archived_at IS NULL
       ORDER BY created_at`,
      session.userId,
    );
    await syncGroupedBrushingReminders(session.userId, children);
  } catch {
    // Swallowed: local data (if any) stays intact.
  }
}

/**
 * Runs preferences recovery (customization + voice + reminders) exactly once
 * per signed-in app session, and hands every caller the SAME in-flight/
 * resolved promise instead of letting them race independent copies of the
 * same work.
 *
 * This matters because `syncChildPreferences` / `syncAllChildPreferences` can
 * be triggered (via `retryPendingCloudSync`) from an app-foreground effect
 * that is NOT sequenced after bootstrap's own `recoverChildPreferences()`
 * call — the two are separate, unawaited effects racing off the same
 * "session ready" signal. If a push fires first for a child whose
 * customization/reminders/voice have not been hydrated on this device yet,
 * it would push local defaults over real cloud data (a genuine destructive
 * overwrite: background/room/reminders silently reset for that child).
 * `ChildPreferencesSyncUseCases.pushSnapshot` also refuses to push an
 * unresolved child that already has a cloud row, as defense in depth, but
 * awaiting this gate first means recovery has normally already caught up
 * every child before any push is attempted at all.
 */
export function ensureChildPreferencesRecovered(): Promise<void> {
  childPreferencesRecoveryPromise ??= recoverChildPreferences();
  return childPreferencesRecoveryPromise;
}
