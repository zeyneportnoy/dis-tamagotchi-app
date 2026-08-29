import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { ageBandFromDateOfBirth } from '@/domain/family';
import { DateOfBirthField } from '@/features/child-profile';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function DateOfBirthScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const [showError, setShowError] = useState(false);

  const selectDate = (dateOfBirth: string): void => {
    const ageBand = ageBandFromDateOfBirth(dateOfBirth);
    draft.setDateOfBirth(dateOfBirth);
    draft.setAgeBand(ageBand);
    setShowError(false);
  };

  const continueFlow = async (): Promise<void> => {
    if (!draft.dateOfBirth || !ageBandFromDateOfBirth(draft.dateOfBirth)) {
      setShowError(true);
      return;
    }
    if (draft.profileId) {
      await (
        await getFamilyUseCases()
      ).updateProfile(draft.profileId, {
        dateOfBirth: draft.dateOfBirth,
      });
      if (!draft.avatarId) return router.replace('/onboarding/character');
      draft.reset();
      return router.replace('/(child)');
    }
    router.push('/onboarding/character');
  };

  return (
    <Screen style={styles.screen} testID="date-of-birth-onboarding-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.copy}>
          <Text style={styles.center} variant="title">
            {t('onboarding.dateOfBirth.title')}
          </Text>
          <Text style={styles.center}>{t('onboarding.dateOfBirth.body')}</Text>
        </View>
        <View style={styles.card}>
          <DateOfBirthField
            cancelLabel={t('common.cancel')}
            confirmLabel={t('common.done')}
            dateOfBirth={draft.dateOfBirth}
            label={t('onboarding.dateOfBirth.label')}
            onChange={selectDate}
            placeholder={t('onboarding.dateOfBirth.placeholder')}
            testID="onboarding-date-of-birth"
          />
          {showError ? <Text style={styles.error}>{t('onboarding.dateOfBirth.error')}</Text> : null}
        </View>
        <Button
          disabled={!draft.dateOfBirth}
          label={t('common.continue')}
          onPress={() => void continueFlow()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  center: { textAlign: 'center' },
  content: { flexGrow: 1, gap: spacing.lg, justifyContent: 'center', paddingBottom: spacing.md },
  copy: { gap: spacing.xs },
  error: { color: colors.brandSecondary },
  screen: { justifyContent: 'flex-start' },
});
