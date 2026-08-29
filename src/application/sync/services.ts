import { getParentAuthUseCases } from '@/application/auth';
import { getSupabaseClient } from '@/data/auth';
import { getDatabase } from '@/data/db';
import {
  SQLiteChildCloudSyncRepository,
  SQLiteProfileSyncRepository,
  SupabaseChildDataRepository,
  SupabaseChildProfileRepository,
} from '@/data/repositories';
import { toLocalDateKey } from '@/domain/brushing';

import { ChildDataSyncUseCases } from './ChildDataSyncUseCases';
import { ProfileSyncUseCases } from './ProfileSyncUseCases';

let useCasesPromise: Promise<ProfileSyncUseCases | null> | undefined;
let childDataSyncPromise: Promise<ChildDataSyncUseCases | null> | undefined;

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

// Only push child_progress when the value actually changed since the last push,
// so a screen-focus `getProgress()` does not spam the network.
const lastPushedProgress = new Map<string, string>();

const evaluationPushFloorDayKey = (): string =>
  toLocalDateKey(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));

/**
 * Fire-and-forget push of a child's Mine Puan + streak, plus its recent slot
 * evaluations. `snapshot` lets callers skip a redundant push when nothing
 * changed. Every failure is swallowed and the change marker is cleared so the
 * next call retries. Local data is the source of truth and is never rolled back
 * here.
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
    await sync.pushProgress(profileId);
    await sync.pushRecentEvaluations(profileId, evaluationPushFloorDayKey());
  } catch {
    if (marker) lastPushedProgress.delete(profileId);
  }
}

/**
 * Fire-and-forget push of one brushing session (stable local UUID → cloud upsert
 * on `id`) followed by the child's progress. Retrying the same session never
 * creates a second cloud row or a second reward.
 */
export async function syncChildBrushingSession(
  profileId: string,
  sessionId: string,
): Promise<void> {
  try {
    const sync = await getChildDataSyncUseCases();
    if (!sync) return;
    await sync.pushSession(profileId, sessionId);
    await sync.pushProgress(profileId);
  } catch {
    // Swallowed: local session + reward already committed.
  }
}

/**
 * On app/session restore: hydrate cloud Mine Puan progress into local SQLite for
 * children that have no local progress row yet. Never overwrites existing local
 * data.
 */
export async function recoverChildCloudProgress(): Promise<void> {
  try {
    const sync = await getChildDataSyncUseCases();
    await sync?.recoverProgress();
  } catch {
    // Swallowed: local data (if any) stays intact.
  }
}
