import { getParentAuthUseCases } from '@/application/auth';
import { getSupabaseClient } from '@/data/auth';
import { getDatabase } from '@/data/db';
import { SQLiteProfileSyncRepository, SupabaseChildProfileRepository } from '@/data/repositories';

import { ProfileSyncUseCases } from './ProfileSyncUseCases';

let useCasesPromise: Promise<ProfileSyncUseCases | null> | undefined;

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
