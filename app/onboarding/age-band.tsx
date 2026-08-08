import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, SelectionCard, Text } from '@/design-system';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function AgeBandScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  return (
    <Screen>
      <Text variant="title">{t('onboarding.ageBand.title')}</Text>
      <SelectionCard
        label={t('onboarding.ageBand.fourSix')}
        onPress={() => draft.setAgeBand('4_6')}
        selected={draft.ageBand === '4_6'}
      />
      <SelectionCard
        label={t('onboarding.ageBand.sevenEleven')}
        onPress={() => draft.setAgeBand('7_11')}
        selected={draft.ageBand === '7_11'}
      />
      <Button
        disabled={!draft.ageBand}
        label={t('common.continue')}
        onPress={() => router.push('/onboarding/character')}
      />
    </Screen>
  );
}
