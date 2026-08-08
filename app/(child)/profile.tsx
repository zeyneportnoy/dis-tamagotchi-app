import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text } from '@/design-system';

export default function ProfileScreen() {
  const { t } = useTranslation();
  return (
    <Screen testID="profile-screen">
      <Text variant="title">{t('placeholders.profileTitle')}</Text>
      <Text>{t('placeholders.profileBody')}</Text>
      <Button
        label={t('childHome.parentArea')}
        onPress={() => router.push('/parent-gate')}
        variant="secondary"
      />
    </Screen>
  );
}
