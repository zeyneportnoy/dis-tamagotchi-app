import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { getFamilyUseCases } from '@/application/family';
import { ErrorState, LoadingState } from '@/design-system';

export default function Index() {
  const [destination, setDestination] = useState<'child' | 'onboarding' | 'error' | null>(null);

  useEffect(() => {
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then((profile) => setDestination(profile ? 'child' : 'onboarding'))
      .catch(() => setDestination('error'));
  }, []);

  if (destination === 'error') return <ErrorState />;
  if (!destination) return <LoadingState />;
  return <Redirect href={destination === 'child' ? '/(child)' : '/onboarding'} />;
}
