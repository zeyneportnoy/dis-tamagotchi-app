import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function AgeBandScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const continueFlow = async (): Promise<void> => {
    if (!draft.ageBand) return;
    if (draft.profileId) {
      await (
        await getFamilyUseCases()
      ).updateProfile(draft.profileId, {
        ageBand: draft.ageBand,
      });
      if (!draft.avatarId) return router.replace('/onboarding/character');
      draft.reset();
      return router.replace('/(child)');
    }
    router.push('/onboarding/character');
  };

  return (
    <Screen style={styles.screen} testID="age-band-onboarding-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.copy}>
          <Text style={styles.center} variant="title">
            {t('onboarding.ageBand.title')}
          </Text>
          <Text style={styles.center}>{t('onboarding.ageBand.body')}</Text>
        </View>
        <View style={styles.card}>
          <Button
            label={t('onboarding.ageBand.fourSix')}
            onPress={() => draft.setAgeBand('4_6')}
          />
          <Button
            label={t('onboarding.ageBand.sevenEleven')}
            onPress={() => draft.setAgeBand('7_11')}
          />
        </View>
        <Button
          disabled={!draft.ageBand}
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
  screen: { justifyContent: 'flex-start' },
});
