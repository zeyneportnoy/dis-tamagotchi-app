import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import { CharacterAvatar } from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

const avatars: readonly StarterAvatarKey[] = ['cheerful-incisor', 'sleepy-molar', 'brave-canine'];

export default function CharacterScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  return (
    <Screen style={styles.screen}>
      <View style={styles.copy}>
        <Text style={styles.center} variant="title">
          {t('onboarding.character.title')}
        </Text>
        <Text style={styles.center}>{t('onboarding.character.body')}</Text>
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={styles.catalog}
        showsHorizontalScrollIndicator={false}
        snapToInterval={238}
        decelerationRate="fast"
      >
        {avatars.map((avatar, index) => {
          const selected = draft.avatarId === avatar;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={avatar}
              onPress={() => draft.setAvatarId(avatar)}
              style={({ pressed }) => [
                styles.characterCard,
                index === 0 ? styles.tone0 : index === 1 ? styles.tone1 : styles.tone2,
                selected && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sparkle}>✦</Text>
              <CharacterAvatar characterKey={avatar} size="large" surface="plain" />
              <View style={styles.pedestal} />
              <Text style={styles.characterName}>
                {t(`onboarding.character.options.${avatar}`)}
              </Text>
              <View style={styles.check}>
                <Text style={styles.checkText}>{selected ? '✓' : '○'}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Button
        disabled={!draft.avatarId}
        label={t('common.continue')}
        onPress={() => router.push('/onboarding/summary')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  catalog: { gap: spacing.md, paddingHorizontal: spacing.md },
  center: { textAlign: 'center' },
  characterCard: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 32,
    borderWidth: 4,
    height: 370,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.md,
    width: 222,
  },
  characterName: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  check: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 40,
  },
  checkText: { color: colors.brandPrimary, fontSize: 24, fontWeight: '900', lineHeight: 28 },
  copy: { gap: spacing.xs },
  pedestal: {
    backgroundColor: '#B27DE2',
    borderRadius: radii.pill,
    height: 24,
    marginTop: -28,
    width: 150,
  },
  pressed: { opacity: 0.82 },
  screen: { justifyContent: 'space-between', paddingHorizontal: 0 },
  selected: { borderColor: colors.brandPrimary },
  sparkle: {
    color: colors.brandHighlight,
    fontSize: 28,
    left: spacing.md,
    lineHeight: 34,
    position: 'absolute',
    top: spacing.md,
  },
  tone0: { backgroundColor: '#F9D7E5' },
  tone1: { backgroundColor: '#D9C7FF' },
  tone2: { backgroundColor: '#BFEFEB' },
});
