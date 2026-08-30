import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
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
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID="parent-gate-scroll"
        >
          <View style={styles.hero}>
            <Text style={styles.sparkleLeft}>✦</Text>
            <Text style={styles.sparkleRight}>★</Text>
            <View style={styles.lockBubble}>
              <Text style={styles.lock}>🔒</Text>
            </View>
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
  back: { left: spacing.lg, position: 'absolute', zIndex: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingBottom: spacing.lg,
  },
  flex: { flex: 1, width: '100%' },
  hero: {
    alignItems: 'center',
    backgroundColor: '#D8D0FF',
    borderRadius: 34,
    height: 190,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  lock: { fontSize: 64, lineHeight: 78 },
  lockBubble: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 120,
    justifyContent: 'center',
    width: 120,
  },
  question: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  screen: { alignItems: 'center', justifyContent: 'flex-start' },
  sparkleLeft: {
    color: colors.brandHighlight,
    fontSize: 28,
    left: spacing.lg,
    position: 'absolute',
    top: spacing.lg,
  },
  sparkleRight: {
    color: colors.brandSecondary,
    fontSize: 26,
    position: 'absolute',
    right: spacing.lg,
    top: 52,
  },
  title: { textAlign: 'center' },
});
