import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/design-system';

export default function ParentPlaceholderScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="title">{t('parent.title')}</Text>
      <Text>{t('parent.placeholder')}</Text>
    </Screen>
  );
}
