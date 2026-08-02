import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../theme';
import { Screen } from './Screen';
import { Text } from './Text';

export function LoadingState() {
  const { t } = useTranslation();
  return (
    <Screen accessibilityLabel={t('common.loading')}>
      <ActivityIndicator
        accessibilityLabel={t('common.loading')}
        color={colors.teal}
        size="large"
      />
      <Text>{t('common.loading')}</Text>
    </Screen>
  );
}

export function ErrorState() {
  const { t } = useTranslation();
  return (
    <Screen accessibilityLabel={t('common.errorTitle')}>
      <Text variant="title">{t('common.errorTitle')}</Text>
      <Text>{t('common.errorBody')}</Text>
    </Screen>
  );
}
