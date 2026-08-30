import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';

const characterRows = [
  [
    {
      key: 'inci',
      source: require('../../assets/characters/moods/inci/developed/happy.png'),
      offsetY: 5,
    },
    {
      key: 'piril',
      source: require('../../assets/characters/moods/piril/developed/happy.png'),
      offsetY: -3,
    },
    {
      key: 'kaan',
      source: require('../../assets/characters/moods/kaan/developed/happy.png'),
      offsetY: 3,
    },
    {
      key: 'milo',
      source: require('../../assets/characters/moods/milo/developed/happy.png'),
      offsetY: -2,
    },
  ],
  [
    {
      key: 'zipzip',
      source: require('../../assets/characters/moods/zipzip/developed/happy.png'),
      offsetY: -4,
    },
    {
      key: 'topi',
      source: require('../../assets/characters/moods/topi/developed/happy.png'),
      offsetY: 4,
    },
    {
      key: 'akil',
      source: require('../../assets/characters/moods/akil/developed/happy.png'),
      offsetY: -3,
    },
    {
      key: 'uyku',
      source: require('../../assets/characters/moods/uyku/developed/happy.png'),
      offsetY: 5,
    },
  ],
] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const heroHeight = Math.min(370, Math.max(286, Math.round(height * 0.43)));

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
          <View pointerEvents="none" style={styles.heroDecorations}>
            <View style={styles.heroGlowPink} />
            <View style={styles.heroGlowBlue} />
            <View style={styles.heroGlowWarm} />
            <View style={[styles.cloud, styles.cloudLeft]} />
            <View style={[styles.cloud, styles.cloudMiddle]} />
            <View style={[styles.cloud, styles.cloudRight]} />
            <View style={[styles.heroSparkle, styles.heroSparkleOne]} />
            <View style={[styles.heroSparkle, styles.heroSparkleTwo]} />
            <View style={[styles.heroSparkle, styles.heroSparkleThree]} />
          </View>

          <View style={styles.characterFamily}>
            {characterRows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.characterRow}>
                {row.map((character, characterIndex) => (
                  <View
                    key={character.key}
                    style={[
                      styles.characterCell,
                      { transform: [{ translateY: character.offsetY }] },
                      characterIndex % 2 === 0
                        ? styles.characterCellForward
                        : styles.characterCellBack,
                    ]}
                  >
                    <View style={styles.characterHalo} />
                    <Image
                      accessibilityIgnoresInvertColors
                      resizeMode="contain"
                      source={character.source}
                      style={styles.characterImage}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
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
  characterCell: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginHorizontal: -4,
    position: 'relative',
  },
  characterCellBack: { zIndex: 1 },
  characterCellForward: { zIndex: 2 },
  characterFamily: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  characterHalo: {
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: radii.pill,
    height: '68%',
    position: 'absolute',
    width: '82%',
  },
  characterImage: {
    height: '112%',
    width: '116%',
  },
  characterRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  cloud: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: radii.pill,
    position: 'absolute',
  },
  cloudLeft: {
    bottom: -26,
    height: 96,
    left: -24,
    width: 176,
  },
  cloudMiddle: {
    bottom: -54,
    height: 124,
    left: '31%',
    width: 190,
  },
  cloudRight: {
    bottom: -30,
    height: 102,
    right: -34,
    width: 176,
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
  heroDecorations: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlowBlue: {
    backgroundColor: 'rgba(171, 220, 255, 0.68)',
    borderRadius: radii.pill,
    height: 230,
    position: 'absolute',
    right: -64,
    top: -58,
    width: 230,
  },
  heroGlowPink: {
    backgroundColor: 'rgba(255, 190, 220, 0.58)',
    borderRadius: radii.pill,
    height: 220,
    left: -58,
    position: 'absolute',
    top: -50,
    width: 220,
  },
  heroGlowWarm: {
    backgroundColor: 'rgba(255, 235, 168, 0.52)',
    borderRadius: radii.pill,
    bottom: -82,
    height: 230,
    left: '22%',
    position: 'absolute',
    width: 230,
  },
  heroSparkle: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 2,
    height: 10,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 10,
  },
  heroSparkleOne: { left: '8%', top: '12%' },
  heroSparkleThree: { bottom: '12%', left: '43%', height: 7, width: 7 },
  heroSparkleTwo: { right: '9%', top: '43%' },
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
