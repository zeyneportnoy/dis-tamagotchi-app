import AsyncStorage from '@react-native-async-storage/async-storage';

import { getParentAuthUseCases } from '@/application/auth';
import { getSupabaseClient } from '@/data/auth';
import { getDatabase } from '@/data/db';
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
  hasStoredVoiceProfile,
  markVoiceProfileSynced,
  readVoiceProfileSyncMeta,
  setBrushingVoiceProfile,
} from '@/features/brushing';
import { reminderSettingsService } from '@/features/reminders';

import { ChildDataSyncUseCases } from './ChildDataSyncUseCases';
import {
  ChildPreferencesSyncUseCases,
  type ChildPreferenceAccessors,
} from './ChildPreferencesSyncUseCases';
import { ProfileSyncUseCases } from './ProfileSyncUseCases';

let useCasesPromise: Promise<ProfileSyncUseCases | null> | undefined;
let childDataSyncPromise: Promise<ChildDataSyncUseCases | null> | undefined;
let childPreferencesSyncPromise: Promise<ChildPreferencesSyncUseCases | null> | undefined;

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
 * Fire-and-forget flush of a child's pending cloud writes (Mine Puan + streak,
 * plus any unsynced sessions / slot evaluations). `snapshot` lets callers skip a
 * redundant call when nothing changed. Every failure is swallowed; the local
 * SQLite sync markers keep the backlog for the next retry. Local data is never
 * rolled back here.
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
 * Fire-and-forget flush after a brushing session finishes. Pushes every unsynced
 * session (stable local UUID → cloud upsert on `id`, so an offline session
 * reaches the cloud under the same id and never grants a second +20), its slot
 * evaluations and progress.
 */
export async function syncChildBrushingSession(
  profileId: string,
  _sessionId: string,
): Promise<void> {
  try {
    const sync = await getChildDataSyncUseCases();
    await sync?.pushChild(profileId);
  } catch {
    // Swallowed: local session + reward already committed.
  }
}

/**
 * On app/session restore: multi-device recovery of Mine Puan progress. Hydrates
 * when local is missing or clean-and-stale; never overwrites local unpushed
 * edits.
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
    const sync = await getChildPreferencesSyncUseCases();
    await sync?.pushForProfile(profileId);
  } catch {
    // Swallowed: local preference already saved.
  }
}

/**
 * Fire-and-forget push for every synced child. Used when a per-parent preference
 * (voice guide, reminder settings) changes, since those apply to all children.
 */
export async function syncAllChildPreferences(): Promise<void> {
  try {
    const sync = await getChildPreferencesSyncUseCases();
    await sync?.pushForAllSyncedChildren();
  } catch {
    // Swallowed: local preference already saved.
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
  } catch {
    // Swallowed: local data (if any) stays intact.
  }
}
