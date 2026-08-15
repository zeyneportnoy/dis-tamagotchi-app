import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, ScreenHeader, Text, colors, radii, spacing } from '@/design-system';
import { isMoodLabAvailable } from '@/features/mood-lab/availability';

export default function ParentSettingsScreen() {
  const { t } = useTranslation();

  return (
    <Screen style={styles.screen} testID="parent-settings-screen">
      <ScreenHeader
        backTestID="parent-settings-back-button"
        fallbackHref="/(parent)"
        onBackPress={() => router.replace('/(parent)')}
        title={t('parent.settings.title')}
      />
      <View style={styles.section}>
        <Button
          label={t('parent.reminders.title')}
          onPress={() => router.push('/(parent)/reminders')}
          variant="secondary"
        />
      </View>
      {isMoodLabAvailable(__DEV__) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('parent.settings.developerTools')}</Text>
          <Button
            label={t('parent.moodLab.open')}
            onPress={() => router.push('/(parent)/mood-lab')}
            variant="secondary"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg, justifyContent: 'flex-start' },
  section: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.brandPrimary, fontSize: 19, fontWeight: '900' },
});
