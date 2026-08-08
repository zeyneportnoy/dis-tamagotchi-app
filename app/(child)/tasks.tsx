import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen, Text, colors, radii, spacing } from '@/design-system';

export default function TasksScreen() {
  const { t } = useTranslation();
  return (
    <Screen style={styles.screen} testID="tasks-screen">
      <View style={styles.iconBubble}>
        <Text style={styles.icon}>✓</Text>
      </View>
      <View style={styles.card}>
        <Text variant="title">{t('placeholders.tasksTitle')}</Text>
        <Text>{t('placeholders.tasksBody')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  icon: { color: colors.brandPrimary, fontSize: 52, fontWeight: '800', lineHeight: 60 },
  iconBubble: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#DDF8F3',
    borderRadius: radii.pill,
    height: 120,
    justifyContent: 'center',
    width: 120,
  },
  screen: { justifyContent: 'center' },
});
