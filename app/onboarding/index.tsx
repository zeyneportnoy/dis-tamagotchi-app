import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text } from '@/design-system';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen testID="welcome-screen">
      <Text variant="title">{t('welcome.title')}</Text>
      <Text>{t('welcome.body')}</Text>
      <Button label={t('welcome.continue')} onPress={() => router.replace('/(child)')} />
    </Screen>
  );
}
