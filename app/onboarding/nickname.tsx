import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Screen, Text } from '@/design-system';
import { nicknameSchema } from '@/domain/family';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function NicknameScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const [nickname, setNickname] = useState(draft.nickname);
  const [showError, setShowError] = useState(false);

  const continueFlow = () => {
    const result = nicknameSchema.safeParse(nickname);
    if (!result.success) return setShowError(true);
    draft.setNickname(result.data);
    router.push('/onboarding/age-band');
  };

  return (
    <Screen>
      <Text variant="title">{t('onboarding.nickname.title')}</Text>
      <Text>{t('onboarding.nickname.body')}</Text>
      <Input
        accessibilityLabel={t('onboarding.nickname.label')}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={20}
        onChangeText={(value) => {
          setNickname(value);
          setShowError(false);
        }}
        placeholder={t('onboarding.nickname.placeholder')}
        value={nickname}
      />
      {showError ? <Text>{t('onboarding.nickname.error')}</Text> : null}
      <Button label={t('common.continue')} onPress={continueFlow} />
    </Screen>
  );
}
