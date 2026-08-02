import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text } from '@/design-system';

export default function AccountlessScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="title">{t('onboarding.accountless.title')}</Text>
      <Text>{t('onboarding.accountless.body')}</Text>
      <Button
        label={t('onboarding.accountless.continue')}
        onPress={() => router.push('/onboarding/nickname')}
      />
    </Screen>
  );
}
