import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BackButton, Input, Screen, Text, colors, radii, spacing } from '@/design-system';
import { createParentChallenge } from '@/features/parent-gate/challenge';

export default function ParentGateScreen() {
  const { t } = useTranslation();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const insets = useSafeAreaInsets();
  const challenge = useMemo(() => createParentChallenge(), []);
  const advancing = useRef(false);
  const [answer, setAnswer] = useState('');
  const [incorrect, setIncorrect] = useState(false);

  const advance = (): void => {
    if (advancing.current) return;
    advancing.current = true;
    Keyboard.dismiss();
    router.replace(next === 'reminders' ? '/(parent)/reminders' : '/(parent)');
  };

  return (
    <Screen style={styles.screen} testID="parent-gate-screen">
      <View pointerEvents="none" style={styles.backgroundGlowLeft} />
      <View pointerEvents="none" style={styles.backgroundGlowRight} />
      <View pointerEvents="none" style={styles.backgroundBlobBottomLeft} />
      <View pointerEvents="none" style={styles.backgroundBlobBottomRight} />
      <View pointerEvents="none" style={styles.backgroundDotOne} />
      <View pointerEvents="none" style={styles.backgroundDotTwo} />
      <View pointerEvents="none" style={styles.backgroundDotThree} />
      <View
        style={[styles.back, { top: insets.top + spacing.sm }]}
        testID="parent-gate-back-safe-area"
      >
        <BackButton testID="detail-back-button" />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        testID="parent-gate-keyboard-view"
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID="parent-gate-scroll"
        >
          <View style={styles.hero}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={require('../assets/onboarding/parent-gate-hero.png')}
              style={styles.heroImage}
            />
          </View>
          <Text style={styles.title} variant="title">
            {t('parentGate.title')}
          </Text>
          <View style={styles.card}>
            <Text style={styles.question}>{t('parentGate.question', challenge)}</Text>
            <Input
              accessibilityLabel={t('parentGate.answerLabel')}
              keyboardType="number-pad"
              onChangeText={(value) => {
                setAnswer(value);
                setIncorrect(false);
                if (value.trim() && Number(value) === challenge.answer) advance();
              }}
              style={styles.answerInput}
              value={answer}
            />
            {incorrect ? <Text>{t('parentGate.incorrect')}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  answerInput: {
    borderColor: colors.teal,
    borderRadius: radii.pill,
    borderWidth: 2,
    fontSize: 24,
    height: 56,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  back: { left: spacing.lg, position: 'absolute', zIndex: 2 },
  backgroundBlobBottomLeft: {
    backgroundColor: '#E9DEFF',
    borderRadius: 120,
    bottom: -85,
    height: 210,
    left: -70,
    opacity: 0.78,
    position: 'absolute',
    transform: [{ rotate: '18deg' }],
    width: 220,
  },
  backgroundBlobBottomRight: {
    backgroundColor: '#D9F5F0',
    borderRadius: 130,
    bottom: -105,
    height: 250,
    opacity: 0.82,
    position: 'absolute',
    right: -95,
    transform: [{ rotate: '-20deg' }],
    width: 240,
  },
  backgroundDotOne: {
    backgroundColor: '#F8DDE8',
    borderRadius: radii.pill,
    bottom: 66,
    height: 13,
    left: '20%',
    position: 'absolute',
    width: 13,
  },
  backgroundDotThree: {
    backgroundColor: '#FFE4A8',
    borderRadius: radii.pill,
    bottom: 38,
    height: 9,
    left: '52%',
    position: 'absolute',
    width: 9,
  },
  backgroundDotTwo: {
    backgroundColor: '#CBEFEA',
    borderRadius: radii.pill,
    bottom: 58,
    height: 10,
    position: 'absolute',
    right: '22%',
    width: 10,
  },
  backgroundGlowLeft: {
    backgroundColor: '#EEE7FF',
    borderRadius: radii.pill,
    height: 230,
    left: -130,
    opacity: 0.55,
    position: 'absolute',
    top: 70,
    width: 230,
  },
  backgroundGlowRight: {
    backgroundColor: '#F4EEFF',
    borderRadius: radii.pill,
    height: 190,
    opacity: 0.7,
    position: 'absolute',
    right: -105,
    top: 24,
    width: 190,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    shadowColor: '#6D55B5',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'flex-start',
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  flex: { flex: 1, width: '100%' },
  hero: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: '#D8D0FF',
    borderRadius: radii.lg,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  question: {
    color: '#2E226D',
    fontFamily: 'Baloo2',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  screen: {
    alignItems: 'center',
    backgroundColor: '#FCFAFF',
    justifyContent: 'flex-start',
  },
  title: {
    color: '#181824',
    fontSize: 29,
    lineHeight: 35,
    textAlign: 'center',
  },
});
