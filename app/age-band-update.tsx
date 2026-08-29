import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { getFamilyUseCases } from '@/application/family';
import { ErrorState, LoadingState } from '@/design-system';
import { isLegacyAgeBand } from '@/domain/family';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function DateOfBirthUpdateRedirect() {
  const draft = useOnboardingDraft();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then((profile) => {
        if (!profile) return router.replace('/onboarding/nickname');
        if (profile.dateOfBirth && !isLegacyAgeBand(profile.ageBand)) {
          return router.replace('/(child)');
        }
        draft.beginExistingProfile({
          id: profile.id,
          nickname: profile.nickname,
          dateOfBirth: profile.dateOfBirth,
          ageBand: profile.ageBand === '4_6' || profile.ageBand === '7_11' ? profile.ageBand : null,
          avatarId: profile.avatarId,
        });
        router.replace('/onboarding/age-band');
      })
      .catch(() => setFailed(true));
  }, [draft]);

  return failed ? <ErrorState /> : <LoadingState />;
}
