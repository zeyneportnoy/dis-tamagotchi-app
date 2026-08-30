import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Input, Screen, Text, colors, radii, spacing } from '@/design-system';
import { nicknameSchema } from '@/domain/family';
import { characterSafeViewport } from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

const nicknameRoomHero = require('../../assets/onboarding/nickname-room-hero.png');

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
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={nicknameRoomHero}
              style={styles.heroImage}
            />
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
    backgroundColor: '#EAF5FF',
    borderColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 2,
    flexShrink: 1,
    height: characterSafeViewport.large.height - spacing.lg,
    justifyContent: 'flex-end',
    minHeight: characterSafeViewport.small.height + spacing.xl + spacing.xl,
    overflow: 'hidden',
  },
  heroImage: { height: '100%', width: '100%' },
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
});
