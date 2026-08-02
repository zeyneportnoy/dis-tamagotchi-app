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
        label={t('onboarding.ageBand.sixEight')}
        onPress={() => draft.setAgeBand('6_8')}
        selected={draft.ageBand === '6_8'}
      />
      <SelectionCard
        label={t('onboarding.ageBand.nineTen')}
        onPress={() => draft.setAgeBand('9_10')}
        selected={draft.ageBand === '9_10'}
      />
      <Button
        disabled={!draft.ageBand}
        label={t('common.continue')}
        onPress={() => router.push('/onboarding/character')}
      />
    </Screen>
  );
}
