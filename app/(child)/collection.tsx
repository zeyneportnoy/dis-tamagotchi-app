import { Screen, Text } from '@/design-system';
import { useTranslation } from 'react-i18next';

export default function CollectionScreen() {
  const { t } = useTranslation();
  return (
    <Screen testID="collection-screen">
      <Text variant="title">{t('placeholders.collectionTitle')}</Text>
      <Text>{t('placeholders.collectionBody')}</Text>
    </Screen>
  );
}
