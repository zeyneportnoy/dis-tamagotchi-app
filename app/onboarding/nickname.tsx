import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Input, Screen, Text, colors, radii, spacing } from '@/design-system';
import { nicknameSchema } from '@/domain/family';
import { characterSafeViewport } from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

const nicknameRoomHero = require('../../assets/onboarding/nickname-room-hero.png');

// Standard iOS UINavigationBar content height. The KeyboardAvoidingView renders
// below the native onboarding Stack header, so its measured frame already starts
// this far (plus the top inset) down the window — feeding that back as the
// vertical offset keeps the padding it adds equal to the real keyboard overlap.
const IOS_NATIVE_HEADER_HEIGHT = 44;

export default function NicknameScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const insets = useSafeAreaInsets();
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + IOS_NATIVE_HEADER_HEIGHT : 0}
        style={styles.keyboardView}
      >
        <View style={styles.skySpace} />
        <View style={styles.panel}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scrollArea}
            testID="nickname-static-content"
          >
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
          </ScrollView>
          <View style={styles.footer}>
            <Button label={t('common.continue')} onPress={() => void continueFlow()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { color: colors.brandPrimary, fontWeight: '800' },
  center: { textAlign: 'center' },
  copy: { gap: spacing.xs },
  footer: { paddingBottom: spacing.lg, paddingTop: spacing.sm },
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
  keyboardView: { flex: 1 },
  nicknameInput: {
    borderColor: colors.brandPrimary,
    borderRadius: radii.lg,
    minHeight: spacing.xl + spacing.xl,
  },
  panel: {
    backgroundColor: colors.offWhite,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  scrollArea: { flex: 1 },
  scrollContent: { flexGrow: 1, gap: spacing.sm },
  screen: {
    backgroundColor: '#DCEEFF',
    gap: 0,
    justifyContent: 'flex-start',
    padding: 0,
  },
  skySpace: { height: spacing.xs },
});
