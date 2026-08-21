import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Input, Screen, Text, colors, radii, spacing } from '@/design-system';
import { nicknameSchema } from '@/domain/family';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function NicknameScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const [nickname, setNickname] = useState(draft.nickname);
  const [showError, setShowError] = useState(false);

  const continueFlow = async (): Promise<void> => {
    const result = nicknameSchema.safeParse(nickname);
    if (!result.success) return setShowError(true);
    draft.setNickname(result.data);
    if (draft.profileId) {
      await (await getFamilyUseCases()).updateProfile(draft.profileId, { nickname: result.data });
      if (!draft.ageBand) return router.replace('/onboarding/age-band');
      if (!draft.avatarId) return router.replace('/onboarding/character');
      draft.reset();
      return router.replace('/(child)');
    }
    router.push('/onboarding/age-band');
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.face}>☺</Text>
            <View style={styles.speech}>
              <Text style={styles.speechText}>Merhaba!</Text>
            </View>
          </View>
          <View style={styles.copy}>
            <Text style={styles.center} variant="title">
              {t('onboarding.nickname.title')}
            </Text>
            <Text style={styles.center}>{t('onboarding.nickname.body')}</Text>
          </View>
          <View style={styles.inputCard}>
            <Input
              accessibilityLabel={t('onboarding.nickname.label')}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={20}
              onChangeText={(value) => {
                setNickname(value);
                setShowError(false);
              }}
              placeholder={t('onboarding.nickname.placeholder')}
              value={nickname}
            />
            {showError ? <Text>{t('onboarding.nickname.error')}</Text> : null}
          </View>
          <Button label={t('common.continue')} onPress={() => void continueFlow()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  content: { flexGrow: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.md },
  copy: { gap: spacing.xs },
  face: { color: colors.brandPrimary, fontSize: 78, lineHeight: 88 },
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    backgroundColor: '#FFF0C9',
    borderRadius: 32,
    height: 190,
    justifyContent: 'center',
  },
  inputCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.sm },
  screen: { justifyContent: 'flex-start' },
  speech: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: spacing.lg,
    top: spacing.md,
  },
  speechText: { color: colors.brandSecondary, fontWeight: '800' },
});
