import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, colors, minimumTouchTarget, radii, spacing } from '@/design-system';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function AgeBandScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.copy}>
          <Text style={styles.center} variant="title">
            {t('onboarding.ageBand.title')}
          </Text>
          <Text style={styles.center}>{t('onboarding.ageBand.body')}</Text>
        </View>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: draft.ageBand === '4_6' }}
          onPress={() => draft.setAgeBand('4_6')}
          style={({ pressed }) => [
            styles.ageCard,
            styles.younger,
            draft.ageBand === '4_6' && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.ageIllustration}>
            <Text style={styles.ageEmoji}>🪥</Text>
          </View>
          <View style={styles.ageCopy}>
            <Text style={styles.ageTitle}>{t('onboarding.ageBand.fourSix')}</Text>
            <Text style={styles.ageHint}>{t('onboarding.ageBand.fourSixHint')}</Text>
          </View>
          <Text style={styles.selection}>{draft.ageBand === '4_6' ? '✓' : '○'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: draft.ageBand === '7_11' }}
          onPress={() => draft.setAgeBand('7_11')}
          style={({ pressed }) => [
            styles.ageCard,
            styles.older,
            draft.ageBand === '7_11' && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.ageIllustration}>
            <Text style={styles.ageEmoji}>✨</Text>
          </View>
          <View style={styles.ageCopy}>
            <Text style={styles.ageTitle}>{t('onboarding.ageBand.sevenEleven')}</Text>
            <Text style={styles.ageHint}>{t('onboarding.ageBand.sevenElevenHint')}</Text>
          </View>
          <Text style={styles.selection}>{draft.ageBand === '7_11' ? '✓' : '○'}</Text>
        </Pressable>
        <Button
          disabled={!draft.ageBand}
          label={t('common.continue')}
          onPress={() => router.push('/onboarding/character')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ageCard: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 28,
    borderWidth: 4,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 150,
    padding: spacing.md,
  },
  ageCopy: { flex: 1, gap: spacing.xs },
  ageEmoji: { fontSize: 44, lineHeight: 52 },
  ageHint: { fontSize: 16, lineHeight: 22 },
  ageIllustration: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.pill,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  ageTitle: { fontSize: 30, fontWeight: '900', lineHeight: 36 },
  center: { textAlign: 'center' },
  content: { flexGrow: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.md },
  copy: { gap: spacing.xs },
  older: { backgroundColor: '#D9C7FF' },
  pressed: { opacity: 0.8 },
  screen: { justifyContent: 'flex-start' },
  selected: { borderColor: colors.brandPrimary },
  selection: {
    color: colors.brandPrimary,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    minWidth: minimumTouchTarget,
  },
  younger: { backgroundColor: '#BFEFEB' },
});
