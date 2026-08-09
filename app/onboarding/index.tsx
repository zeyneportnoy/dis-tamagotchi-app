import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { CharacterAvatar } from '@/features/character';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen style={styles.screen} testID="welcome-screen">
      <View style={styles.sparkleOne}>
        <Text style={styles.sparkle}>✦</Text>
      </View>
      <View style={styles.sparkleTwo}>
        <Text style={styles.sparkle}>★</Text>
      </View>
      <View style={styles.hero}>
        <View style={styles.heroTop} />
        <View style={styles.cloudLeft} />
        <View style={styles.cloudRight} />
        <View style={styles.rug} />
        <CharacterAvatar characterKey="cheerful-incisor" size="hero" surface="plain" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} variant="title">
          {t('welcome.title')}
        </Text>
        <Text style={styles.body}>{t('welcome.body')}</Text>
      </View>
      <View style={styles.actions}>
        <Button label={t('welcome.createAccount')} onPress={() => router.push('/auth/signup')} />
        <Button
          label={t('welcome.signIn')}
          onPress={() => router.push('/auth/login')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  body: { textAlign: 'center' },
  cloudLeft: {
    backgroundColor: '#F8A8C5',
    borderRadius: radii.pill,
    bottom: 0,
    height: 76,
    left: -20,
    position: 'absolute',
    width: 170,
  },
  cloudRight: {
    backgroundColor: '#F7B3D0',
    borderRadius: radii.pill,
    bottom: -10,
    height: 92,
    position: 'absolute',
    right: -28,
    width: 190,
  },
  copy: { alignItems: 'center', gap: spacing.sm },
  hero: {
    alignItems: 'center',
    backgroundColor: '#BD8BF2',
    borderRadius: 34,
    height: 330,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  heroTop: {
    backgroundColor: colors.brandPrimary,
    height: 165,
    left: 0,
    opacity: 0.45,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  rug: {
    backgroundColor: '#C86AB1',
    borderRadius: radii.pill,
    bottom: 30,
    height: 34,
    position: 'absolute',
    width: 190,
  },
  screen: { justifyContent: 'space-between' },
  sparkle: { color: colors.brandHighlight, fontSize: 28, lineHeight: 32 },
  sparkleOne: { left: spacing.xl, position: 'absolute', top: 48 },
  sparkleTwo: { position: 'absolute', right: spacing.xl, top: 82 },
  title: { textAlign: 'center' },
});
