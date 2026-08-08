import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import { ErrorState, LoadingState, Screen, SelectionCard, Text } from '@/design-system';
import type { AgeBand } from '@/domain/family';

export default function AgeBandUpdateScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then((activeProfile) => {
        if (!activeProfile) return router.replace('/onboarding');
        if (activeProfile.ageBand === '4_6' || activeProfile.ageBand === '7_11') {
          return router.replace('/(child)');
        }
        setProfile(activeProfile);
      })
      .catch(() => setFailed(true));
  }, []);

  const updateAgeBand = async (ageBand: AgeBand): Promise<void> => {
    if (!profile) return;
    setFailed(false);
    try {
      const useCases = await getFamilyUseCases();
      await useCases.updateProfile(profile.id, { ageBand });
      router.replace('/(child)');
    } catch {
      setFailed(true);
    }
  };

  if (failed) return <ErrorState />;
  if (!profile) return <LoadingState />;

  return (
    <Screen testID="age-band-update-screen">
      <Text variant="title">{t('ageBandUpdate.title')}</Text>
      <Text>{t('ageBandUpdate.body')}</Text>
      <SelectionCard
        label={t('ageBandUpdate.fourSix')}
        onPress={() => void updateAgeBand('4_6')}
        selected={false}
      />
      <SelectionCard
        label={t('ageBandUpdate.sevenEleven')}
        onPress={() => void updateAgeBand('7_11')}
        selected={false}
      />
    </Screen>
  );
}
