import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { getFamilyUseCases } from '@/application/family';
import {
  getProfileSyncUseCases,
  recoverChildBrushingHistory,
  recoverChildCloudProgress,
  recoverChildPreferences,
  retryPendingCloudSync,
} from '@/application/sync';
import { ErrorState } from '@/design-system';
import { isLegacyAgeBand } from '@/domain/family';
import { useAuth } from '@/features/auth';
import { BrandedSplash } from '@/features/splash';

type Destination =
  'age-band-update' | 'child' | 'onboarding' | 'profile-onboarding' | 'claim-local' | 'error';

export default function Index() {
  const { configured, loading: authLoading, session } = useAuth();
  const userId = session?.userId ?? null;
  // Account isolation: the resolved route is tagged with the user it was resolved
  // for. When the signed-in user changes (logout → another login) the tag stops
  // matching, so the previous account's screen can never flash before the new
  // bootstrap runs.
  const [resolved, setResolved] = useState<{
    userId: string | null;
    destination: Destination | null;
  }>({ userId: null, destination: null });
  const destination = resolved.userId === userId ? resolved.destination : null;

  useEffect(() => {
    if (authLoading || !configured || !session || !session.emailVerified) return;
    const tag = (value: Destination) =>
      setResolved((prev) =>
        prev.userId === session.userId && prev.destination === value
          ? prev
          : { userId: session.userId, destination: value },
      );
    void getProfileSyncUseCases()
      .then(async (sync) => {
        if (sync && (await sync.countLegacyProfiles(session.userId)) > 0)
          return 'claim-local' as const;
        if (sync) await sync.recoverFromCloud();
        // Child profiles exist locally now. Recover Mine Puan (multi-device
        // conflict-aware) and — before any getProgress()/reconcile runs —
        // brushing + slot-evaluation history, so hydrated evaluations block a
        // second -10. Then per-child preferences.
        await recoverChildCloudProgress();
        await recoverChildBrushingHistory();
        await recoverChildPreferences();
        // Flush anything this device changed while offline (never blocks routing).
        void retryPendingCloudSync();
        const useCases = await getFamilyUseCases();
        return useCases.getActiveProfile();
      })
      .then((result) => {
        if (result === 'claim-local') return tag('claim-local');
        const profile = result;
        tag(
          profile
            ? !profile.dateOfBirth || isLegacyAgeBand(profile.ageBand)
              ? 'age-band-update'
              : 'child'
            : 'profile-onboarding',
        );
      })
      .catch((error: unknown) => {
        console.error('index: profile bootstrap failed', error);
        tag('error');
      });
  }, [authLoading, configured, session]);

  if (authLoading) return <BrandedSplash />;
  if (!configured || !session) return <Redirect href="/onboarding" />;
  if (!session.emailVerified) return <BrandedSplash />;
  if (destination === 'error') return <ErrorState />;
  if (!destination) return <BrandedSplash />;
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
