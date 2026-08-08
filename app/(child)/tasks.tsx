import { Screen, Text } from '@/design-system';
import { useTranslation } from 'react-i18next';

export default function TasksScreen() {
  const { t } = useTranslation();
  return (
    <Screen testID="tasks-screen">
      <Text variant="title">{t('placeholders.tasksTitle')}</Text>
      <Text>{t('placeholders.tasksBody')}</Text>
    </Screen>
  );
}
