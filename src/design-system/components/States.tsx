import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../theme';
import { Screen } from './Screen';
import { Text } from './Text';

export function LoadingState({ label }: { label?: string } = {}) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading');
  return (
    <Screen accessibilityLabel={resolvedLabel}>
      <ActivityIndicator accessibilityLabel={resolvedLabel} color={colors.teal} size="large" />
      <Text>{resolvedLabel}</Text>
    </Screen>
  );
}

export function ErrorState({ body }: { body?: string } = {}) {
  const { t } = useTranslation();
  return (
    <Screen accessibilityLabel={t('common.errorTitle')}>
      <Text variant="title">{t('common.errorTitle')}</Text>
      <Text>{body ?? t('common.errorBody')}</Text>
    </Screen>
  );
}
