import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text } from '@/design-system';

export default function ParentPlaceholderScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="title">{t('parent.title')}</Text>
      <Text>{t('parent.placeholder')}</Text>
      <Button
        label={t('parent.addProfile')}
        onPress={() => router.push('/onboarding/accountless')}
      />
    </Screen>
  );
}
