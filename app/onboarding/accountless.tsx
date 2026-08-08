import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';

export default function AccountlessScreen() {
  const { t } = useTranslation();
  return (
    <Screen style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.device}>
          <Text style={styles.deviceIcon}>⌂</Text>
        </View>
        <Text style={styles.heart}>♥</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.center} variant="title">
          {t('onboarding.accountless.title')}
        </Text>
        <Text style={styles.center}>{t('onboarding.accountless.body')}</Text>
      </View>
      <Button
        label={t('onboarding.accountless.continue')}
        onPress={() => router.push('/onboarding/nickname')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
  device: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    height: 132,
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    width: 108,
  },
  deviceIcon: { color: colors.brandPrimary, fontSize: 62, lineHeight: 70 },
  heart: {
    color: colors.brandSecondary,
    fontSize: 42,
    lineHeight: 48,
    position: 'absolute',
    right: 44,
    top: 30,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: '#DDF8F3',
    borderRadius: 34,
    height: 260,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  screen: { justifyContent: 'space-between' },
});
