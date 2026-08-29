import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Input, Screen, Text, colors, radii, spacing } from '@/design-system';
import { nicknameSchema } from '@/domain/family';
import { CharacterAvatar, CharacterSceneDecor, characterSafeViewport } from '@/features/character';
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
      if (!draft.dateOfBirth) return router.replace('/onboarding/age-band');
      if (!draft.avatarId) return router.replace('/onboarding/character');
      draft.reset();
      return router.replace('/(child)');
    }
    router.push('/onboarding/age-band');
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => null,
          headerTitle: () => (
            <Text style={styles.brand} variant="subtitle">
              {t('common.appName')}
            </Text>
          ),
        }}
      />
      <View style={styles.content} testID="nickname-static-content">
        <View style={styles.skySpace} />
        <View style={styles.body}>
          <View style={styles.hero}>
            <CharacterSceneDecor density="playful" tone="yellow" />
            <View pointerEvents="none" style={styles.heroGlow} />
            <View pointerEvents="none" style={styles.heroGround} />
            <View style={styles.heroCharacter}>
              <CharacterAvatar
                characterKey="inci"
                growthStage={2}
                mood="happy"
                size="large"
                surface="plain"
              />
            </View>
            <View style={styles.speech}>
              <Text style={styles.speechText}>{t('onboarding.nickname.greeting')}</Text>
              <View style={styles.speechTail} />
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
              keyboardType="default"
              maxLength={20}
              onChangeText={(value) => {
                setNickname(value);
                setShowError(false);
              }}
              placeholder={t('onboarding.nickname.placeholder')}
              style={styles.nicknameInput}
              value={nickname}
            />
            {showError ? <Text>{t('onboarding.nickname.error')}</Text> : null}
          </View>
          <View style={styles.action}>
            <Button label={t('common.continue')} onPress={() => void continueFlow()} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: 'auto', paddingTop: spacing.sm },
  body: {
    backgroundColor: colors.offWhite,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    flex: 1,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  brand: { color: colors.brandPrimary, fontWeight: '800' },
  center: { textAlign: 'center' },
  content: { flex: 1 },
  copy: { gap: spacing.xs },
  hero: {
    alignItems: 'center',
    backgroundColor: '#FFF0C9',
    borderColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 2,
    flexShrink: 1,
    height: characterSafeViewport.large.height - spacing.lg,
    justifyContent: 'flex-end',
    minHeight: characterSafeViewport.small.height + spacing.xl + spacing.xl,
    overflow: 'hidden',
  },
  heroCharacter: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    transform: [{ scale: 1.12 }, { translateY: spacing.sm }],
    zIndex: 1,
  },
  heroGlow: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: radii.pill,
    bottom: spacing.md,
    height: '72%',
    position: 'absolute',
    width: '82%',
  },
  heroGround: {
    backgroundColor: 'rgba(255,209,102,0.28)',
    borderRadius: radii.pill,
    bottom: spacing.sm,
    height: spacing.lg,
    position: 'absolute',
    width: '78%',
  },
  inputCard: { gap: spacing.xs },
  nicknameInput: {
    borderColor: colors.brandPrimary,
    borderRadius: radii.lg,
    minHeight: spacing.xl + spacing.xl,
  },
  screen: {
    backgroundColor: '#DCEEFF',
    gap: 0,
    justifyContent: 'flex-start',
    padding: 0,
  },
  skySpace: { height: spacing.xs },
  speech: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: spacing.lg,
    shadowColor: colors.brandPrimary,
    shadowOffset: { height: spacing.xs, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: spacing.sm,
    top: spacing.md,
    zIndex: 2,
  },
  speechText: { color: colors.brandSecondary, fontWeight: '800' },
  speechTail: {
    backgroundColor: colors.white,
    bottom: -spacing.xs,
    height: spacing.sm,
    left: spacing.lg,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: spacing.sm,
  },
});
