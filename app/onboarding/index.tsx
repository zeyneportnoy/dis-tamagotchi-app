import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';

const welcomeFamilyHero = require('../../assets/onboarding/welcome-family-hero.png');

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const heroHeight = Math.min(470, Math.max(350, Math.round(height * 0.52)));

  return (
    <Screen style={styles.screen} testID="welcome-screen">
      <View pointerEvents="none" style={styles.pageDecorations}>
        <View style={styles.pageGlowLavender} />
        <View style={styles.pageGlowBlue} />
        <View style={styles.pageGlowMint} />
        <View style={[styles.pageSparkle, styles.pageSparkleLeft]} />
        <View style={[styles.pageSparkle, styles.pageSparkleRight]} />
        <View style={styles.pageBubble} />
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { height: heroHeight }]}> 
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={welcomeFamilyHero}
            style={styles.heroImage}
          />
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    width: '100%',
  },
  body: {
    color: colors.textMuted,
    maxWidth: 330,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  hero: {
    backgroundColor: '#E7E5FF',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 36,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#8875D8',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    width: '100%',
  },
  heroImage: { height: '100%', width: '100%' },
  pageBubble: {
    borderColor: 'rgba(130, 188, 246, 0.22)',
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 44,
    position: 'absolute',
    right: '5%',
    top: '51%',
    width: 44,
  },
  pageDecorations: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  pageGlowBlue: {
    backgroundColor: 'rgba(177, 220, 255, 0.38)',
    borderRadius: radii.pill,
    height: 330,
    position: 'absolute',
    right: -130,
    top: '18%',
    width: 330,
  },
  pageGlowLavender: {
    backgroundColor: 'rgba(210, 194, 255, 0.42)',
    borderRadius: radii.pill,
    height: 360,
    left: -160,
    position: 'absolute',
    top: -100,
    width: 360,
  },
  pageGlowMint: {
    backgroundColor: 'rgba(190, 240, 222, 0.3)',
    borderRadius: radii.pill,
    bottom: -150,
    height: 350,
    left: '12%',
    position: 'absolute',
    width: 350,
  },
  pageSparkle: {
    backgroundColor: 'rgba(151, 126, 232, 0.35)',
    borderRadius: 2,
    height: 12,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  pageSparkleLeft: { left: spacing.lg, top: '48%' },
  pageSparkleRight: { right: spacing.xl, top: spacing.xl },
  screen: {
    backgroundColor: '#FBFAFF',
    gap: 0,
    padding: 0,
  },
  title: {
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
