import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { getFamilyUseCases } from '@/application/family';
import {
  getProfileSyncUseCases,
  recoverChildCloudProgress,
  recoverChildPreferences,
} from '@/application/sync';
import { ErrorState, LoadingState } from '@/design-system';
import { isLegacyAgeBand } from '@/domain/family';
import { useAuth } from '@/features/auth';

export default function Index() {
  const { configured, loading: authLoading, session } = useAuth();
  const [destination, setDestination] = useState<
    | 'age-band-update'
    | 'child'
    | 'onboarding'
    | 'profile-onboarding'
    | 'claim-local'
    | 'error'
    | null
  >(null);

  useEffect(() => {
    if (authLoading || !configured || !session || !session.emailVerified) return;
    void getProfileSyncUseCases()
      .then(async (sync) => {
        if (sync && (await sync.countLegacyProfiles(session.userId)) > 0)
          return 'claim-local' as const;
        if (sync) await sync.recoverFromCloud();
        // Child profiles exist locally now; hydrate cloud Mine Puan + preferences
        // for any that have nothing stored locally (never overwrites local data).
        await recoverChildCloudProgress();
        await recoverChildPreferences();
        const useCases = await getFamilyUseCases();
        return useCases.getActiveProfile();
      })
      .then((result) => {
        if (result === 'claim-local') return setDestination('claim-local');
        const profile = result;
        setDestination(
          profile
            ? !profile.dateOfBirth || isLegacyAgeBand(profile.ageBand)
              ? 'age-band-update'
              : 'child'
            : 'profile-onboarding',
        );
      })
      .catch((error: unknown) => {
        console.error('index: profile bootstrap failed', error);
        setDestination('error');
      });
  }, [authLoading, configured, session]);

  if (authLoading) return <LoadingState />;
  if (!configured || !session) return <Redirect href="/onboarding" />;
  if (!session.emailVerified) return <LoadingState />;
  if (destination === 'error') return <ErrorState />;
  if (!destination) return <LoadingState />;
  const href =
    destination === 'child'
      ? '/(child)'
      : destination === 'age-band-update'
        ? '/age-band-update'
        : destination === 'claim-local'
          ? '/auth/claim-local'
          : destination === 'profile-onboarding'
            ? '/onboarding/nickname'
            : '/onboarding';
  return <Redirect href={href as Href} />;
}
