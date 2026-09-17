import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, ScreenHeader, SelectionCard, Text, colors, radii, spacing } from '@/design-system';

type CavityRiskQuestion = Readonly<{ text: string; options: readonly string[] }>;
type RiskLevel = 'low' | 'medium' | 'high';
type TipKey =
  | 'sugar'
  | 'nightIntake'
  | 'fluoride'
  | 'brushingFrequency'
  | 'parentSupervision'
  | 'plaque'
  | 'dentistCheck'
  | 'existingCaries'
  | 'specialCondition';

const totalQuestions = 10;

function at(answers: readonly number[], index: number): number {
  return answers[index] ?? 0;
}

// Internal 0/1/2 scoring per answer — never shown to the user (see spec §4).
function computeRiskLevel(answers: readonly number[]): RiskLevel {
  const total = answers.reduce((sum, value) => sum + value, 0);
  const overrideHigh = at(answers, 0) === 2 || at(answers, 1) === 2;
  if (overrideHigh) return 'high';
  if (total <= 4) return 'low';
  if (total <= 9) return 'medium';
  return 'high';
}

function selectTipKeys(answers: readonly number[]): TipKey[] {
  const candidates: { key: TipKey; weight: number }[] = [];
  if (at(answers, 2) >= 1) candidates.push({ key: 'sugar', weight: at(answers, 2) });
  if (at(answers, 3) >= 1) candidates.push({ key: 'nightIntake', weight: at(answers, 3) });
  if (at(answers, 4) >= 1) candidates.push({ key: 'fluoride', weight: at(answers, 4) });
  if (at(answers, 5) >= 1) candidates.push({ key: 'brushingFrequency', weight: at(answers, 5) });
  if (at(answers, 6) >= 1) candidates.push({ key: 'parentSupervision', weight: at(answers, 6) });
  if (at(answers, 7) >= 1) candidates.push({ key: 'plaque', weight: at(answers, 7) });
  if (at(answers, 9) >= 1) candidates.push({ key: 'dentistCheck', weight: at(answers, 9) });
  const existingCariesWeight = Math.max(at(answers, 0), at(answers, 1));
  if (existingCariesWeight >= 1) candidates.push({ key: 'existingCaries', weight: existingCariesWeight });
  if (at(answers, 8) === 2) candidates.push({ key: 'specialCondition', weight: 2 });

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((candidate) => candidate.key);
}

export default function CavityRiskTestScreen() {
  const { t } = useTranslation();
  const questions = t('parent.cavityRiskTest.questions', {
    returnObjects: true,
  }) as readonly CavityRiskQuestion[];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<readonly (number | null)[]>(
    () => Array(totalQuestions).fill(null) as (number | null)[],
  );
  const [phase, setPhase] = useState<'quiz' | 'result'>('quiz');

  const exit = (): void => router.replace('/(parent)/settings');

  const selectOption = (value: number): void => {
    setAnswers((previous) => previous.map((answer, i) => (i === index ? value : answer)));
  };

  const goBack = (): void => {
    if (index > 0) setIndex(index - 1);
  };

  const goNext = (): void => {
    if (answers[index] === null) return;
    if (index === totalQuestions - 1) {
      setPhase('result');
      return;
    }
    setIndex(index + 1);
  };

  if (phase === 'result') {
    const finalAnswers = answers.map((answer) => answer ?? 0);
    const level = computeRiskLevel(finalAnswers);
    const overrideHigh = level === 'high' && (at(finalAnswers, 0) === 2 || at(finalAnswers, 1) === 2);
    const tipKeys = level === 'low' ? [] : selectTipKeys(finalAnswers);
    const levelColor =
      level === 'low' ? colors.success : level === 'medium' ? colors.warning : colors.danger;

    return (
      <Screen style={styles.screen} testID="cavity-risk-test-screen">
        <ScreenHeader
          backTestID="cavity-risk-test-result-back-button"
          fallbackHref="/(parent)/settings"
          onBackPress={exit}
          title={t('parent.cavityRiskTest.title')}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.resultCard} testID="cavity-risk-test-result">
            <Text style={[styles.resultTitle, { color: levelColor }]}>
              {t(`parent.cavityRiskTest.result.${level}.title`)}
            </Text>
            <Text style={styles.resultBody}>{t(`parent.cavityRiskTest.result.${level}.body`)}</Text>
            {level === 'low' ? (
              <Text style={styles.resultBody}>{t('parent.cavityRiskTest.result.low.tip')}</Text>
            ) : (
              <View style={styles.tipsList}>
                {tipKeys.map((key) => (
                  <Text key={key} style={styles.resultBody}>
                    {t(`parent.cavityRiskTest.tips.${key}`)}
                  </Text>
                ))}
              </View>
            )}
            {overrideHigh ? (
              <Text style={styles.extraNote}>{t('parent.cavityRiskTest.result.high.extraNote')}</Text>
            ) : null}
          </View>
          <Text variant="caption" style={styles.disclaimer}>
            {t('parent.cavityRiskTest.disclaimer')}
          </Text>
          <Button label={t('parent.cavityRiskTest.done')} onPress={exit} testID="cavity-risk-test-done" />
        </ScrollView>
      </Screen>
    );
  }

  const question = questions[index];
  if (!question) return null;
  const selectedValue = answers[index];
  const progressRatio = (index + 1) / totalQuestions;

  return (
    <Screen style={styles.screen} testID="cavity-risk-test-screen">
      <ScreenHeader
        backTestID="cavity-risk-test-back-button"
        fallbackHref="/(parent)/settings"
        onBackPress={exit}
        title={t('parent.cavityRiskTest.title')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {t('parent.cavityRiskTest.progress', { current: index + 1, total: totalQuestions })}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
        </View>
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.text}</Text>
          <View style={styles.options}>
            {question.options.map((option, optionIndex) => (
              <SelectionCard
                key={option}
                label={option}
                onPress={() => selectOption(optionIndex)}
                selected={selectedValue === optionIndex}
                testID={`cavity-risk-test-option-${optionIndex}`}
              />
            ))}
          </View>
        </View>
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button
              disabled={index === 0}
              label={t('parent.cavityRiskTest.back')}
              onPress={goBack}
              testID="cavity-risk-test-back"
              variant="secondary"
            />
          </View>
          <View style={styles.actionButton}>
            <Button
              disabled={selectedValue === null}
              label={t(
                index === totalQuestions - 1
                  ? 'parent.cavityRiskTest.seeResult'
                  : 'parent.cavityRiskTest.continueLabel',
              )}
              onPress={goNext}
              testID="cavity-risk-test-continue"
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  disclaimer: { opacity: 0.72, paddingHorizontal: spacing.md, textAlign: 'center' },
  extraNote: { color: colors.danger, fontWeight: '700', lineHeight: 20 },
  options: { gap: spacing.sm },
  progressFill: { backgroundColor: colors.brandPrimary, borderRadius: radii.pill, height: '100%' },
  progressLabel: { color: colors.brandPrimary, fontWeight: '800' },
  progressRow: { gap: spacing.xs },
  progressTrack: {
    backgroundColor: '#EDE9FB',
    borderRadius: radii.pill,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  questionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  questionText: { color: colors.textPrimary, fontSize: 19, fontWeight: '800', lineHeight: 26 },
  resultBody: { color: colors.textPrimary, lineHeight: 22 },
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  resultTitle: { fontSize: 22, fontWeight: '900' },
  screen: { gap: spacing.lg, justifyContent: 'flex-start' },
  tipsList: { gap: spacing.sm },
});
