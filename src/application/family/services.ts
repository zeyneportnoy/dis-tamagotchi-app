import type { CreateChildProfileInput, UpdateChildProfileInput } from '@/domain/family';
import { getDatabase } from '@/data/db';
import { SQLiteChildProfileRepository, SQLiteFamilyRepository } from '@/data/repositories';
import { getParentAuthUseCases } from '@/application/auth';
import { pushPendingChildProfiles } from '@/application/sync';

import { FamilyUseCases } from './useCases';
import type { ChildProfileViewModel } from './viewModels';

/**
 * Child profiles are still created/updated locally first (offline-first). This
 * wrapper adds the Supabase side: after a successful local write it flushes the
 * now-`pending` row to `public.child_profiles` in the background. The push is
 * fire-and-forget — a failure never blocks the UI or touches local data.
 */
class CloudAwareFamilyUseCases extends FamilyUseCases {
  override async createProfile(
    input: Omit<CreateChildProfileInput, 'familyId'>,
  ): Promise<ChildProfileViewModel> {
    const profile = await super.createProfile(input);
    void pushPendingChildProfiles();
    return profile;
  }

  override async updateProfile(
    profileId: string,
    input: UpdateChildProfileInput,
  ): Promise<ChildProfileViewModel> {
    const profile = await super.updateProfile(profileId, input);
    void pushPendingChildProfiles();
    return profile;
  }
}

let useCasesPromise: Promise<FamilyUseCases> | undefined;

export function getFamilyUseCases(): Promise<FamilyUseCases> {
  useCasesPromise ??= getDatabase().then(
    (database) =>
      new CloudAwareFamilyUseCases(
        new SQLiteFamilyRepository(database),
        new SQLiteChildProfileRepository(database, undefined, undefined, async () => {
          const auth = getParentAuthUseCases();
          return (await auth?.getSession())?.userId ?? null;
        }),
      ),
  );
  return useCasesPromise;
}
