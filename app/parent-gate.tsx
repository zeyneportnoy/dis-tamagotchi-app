import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BackButton, Button, Input, Screen, Text, colors, radii, spacing } from '@/design-system';
import { StyleSheet, View } from 'react-native';
import { createParentChallenge } from '@/features/parent-gate/challenge';

export default function ParentGateScreen() {
  const { t } = useTranslation();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const challenge = useMemo(() => createParentChallenge(), []);
  const [answer, setAnswer] = useState('');
  const [incorrect, setIncorrect] = useState(false);

  const submit = () => {
    if (Number(answer) === challenge.answer)
      return router.replace(next === 'reminders' ? '/(parent)/reminders' : '/(parent)');
    setIncorrect(true);
    setAnswer('');
  };

  return (
    <Screen style={styles.screen} testID="parent-gate-screen">
      <View style={styles.back}>
        <BackButton testID="detail-back-button" />
      </View>
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
          }}
          value={answer}
        />
        {incorrect ? <Text>{t('parentGate.incorrect')}</Text> : null}
        <Button label={t('parentGate.submit')} onPress={submit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { left: spacing.lg, position: 'absolute', top: spacing.sm, zIndex: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
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
  screen: { alignItems: 'center', gap: spacing.md, justifyContent: 'center' },
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
