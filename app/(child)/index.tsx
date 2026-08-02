import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/design-system';

export default function ChildHomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen testID="child-home-screen">
      <Text variant="title">{t('childHome.title')}</Text>
      <Text>{t('childHome.placeholder')}</Text>
    </Screen>
  );
}
