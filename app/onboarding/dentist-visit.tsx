import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, SelectionCard, Text, colors, radii, spacing } from '@/design-system';
import { formatDateOfBirth } from '@/domain/family';
import { DentistDatePickerModal, nextRoutineCheckDate } from '@/features/reminders';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function OnboardingDentistVisitScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const [choice, setChoice] = useState<'add' | 'skip' | null>(
    draft.dentistLastVisitDate ? 'add' : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastVisitDate = draft.dentistLastVisitDate;

  const goToSummary = (): void => router.push('/onboarding/summary');

  return (
    <Screen style={styles.screen} testID="onboarding-dentist-visit-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.copy}>
          <Text style={styles.center} variant="title">
            {t('onboarding.dentistVisit.title')}
          </Text>
          <Text style={styles.center}>{t('onboarding.dentistVisit.body')}</Text>
        </View>

        <View accessibilityRole="radiogroup" style={styles.choices}>
          <SelectionCard
            label={t('onboarding.dentistVisit.add')}
            onPress={() => {
              setChoice('add');
              setPickerOpen(true);
            }}
            selected={choice === 'add'}
            testID="onboarding-dentist-add"
          />
          <SelectionCard
            label={t('onboarding.dentistVisit.skip')}
            onPress={() => {
              setChoice('skip');
              draft.setDentistLastVisit(null);
              goToSummary();
            }}
            selected={choice === 'skip'}
            testID="onboarding-dentist-skip"
          />
        </View>

        {choice === 'add' && lastVisitDate ? (
          <View style={styles.result} testID="onboarding-dentist-result">
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {t('parent.dentistVisits.routine.lastVisitLabel')}
              </Text>
              <Text style={styles.resultValue}>{formatDateOfBirth(lastVisitDate)}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {t('onboarding.dentistVisit.nextCheckLabel')}
              </Text>
              <Text style={styles.resultValue}>
                {formatDateOfBirth(nextRoutineCheckDate(lastVisitDate))}
              </Text>
            </View>
            <Text style={styles.explainer}>{t('onboarding.dentistVisit.nextCheckExplainer')}</Text>
            <Button
              label={t('onboarding.dentistVisit.pickerTitle')}
              onPress={() => setPickerOpen(true)}
              testID="onboarding-dentist-change"
              variant="secondary"
            />
          </View>
        ) : null}

        {choice === 'add' ? (
          <Button
            label={t('onboarding.dentistVisit.continue')}
            onPress={goToSummary}
            testID="onboarding-dentist-continue"
          />
        ) : null}
      </ScrollView>

      <DentistDatePickerModal
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.done')}
        maximumDate={new Date()}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(date) => {
          draft.setDentistLastVisit(date);
          setPickerOpen(false);
        }}
        testID="onboarding-dentist-picker"
        title={t('onboarding.dentistVisit.pickerTitle')}
        value={lastVisitDate}
        visible={pickerOpen}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  choices: { gap: spacing.sm },
  content: { flexGrow: 1, gap: spacing.lg, justifyContent: 'center', paddingBottom: spacing.lg },
  copy: { gap: spacing.sm },
  explainer: { color: colors.textPrimary, lineHeight: 20, opacity: 0.66 },
  result: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  resultLabel: { color: colors.navy, fontWeight: '800' },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  resultValue: { color: colors.brandPrimary, fontWeight: '800' },
  screen: { justifyContent: 'flex-start' },
});
