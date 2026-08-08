import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, SelectionCard, Text, spacing } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import { CharacterAvatar } from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

const avatars: readonly StarterAvatarKey[] = ['cheerful-incisor', 'sleepy-molar', 'brave-canine'];

export default function CharacterScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  return (
    <Screen>
      <Text variant="title">{t('onboarding.character.title')}</Text>
      {avatars.map((avatar) => (
        <View key={avatar} style={styles.choice}>
          <CharacterAvatar characterKey={avatar} size="small" />
          <View style={styles.card}>
            <SelectionCard
              label={t(`onboarding.character.options.${avatar}`)}
              onPress={() => draft.setAvatarId(avatar)}
              selected={draft.avatarId === avatar}
            />
          </View>
        </View>
      ))}
      <Button
        disabled={!draft.avatarId}
        label={t('common.continue')}
        onPress={() => router.push('/onboarding/summary')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  choice: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
});
