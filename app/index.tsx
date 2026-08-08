import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { getFamilyUseCases } from '@/application/family';
import { ErrorState, LoadingState } from '@/design-system';
import { isLegacyAgeBand } from '@/domain/family';

export default function Index() {
  const [destination, setDestination] = useState<
    'age-band-update' | 'child' | 'onboarding' | 'error' | null
  >(null);

  useEffect(() => {
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then((profile) =>
        setDestination(
          profile ? (isLegacyAgeBand(profile.ageBand) ? 'age-band-update' : 'child') : 'onboarding',
        ),
      )
      .catch(() => setDestination('error'));
  }, []);

  if (destination === 'error') return <ErrorState />;
  if (!destination) return <LoadingState />;
  const href =
    destination === 'child'
      ? '/(child)'
      : destination === 'age-band-update'
        ? '/age-band-update'
        : '/onboarding';
  return <Redirect href={href as Href} />;
}
