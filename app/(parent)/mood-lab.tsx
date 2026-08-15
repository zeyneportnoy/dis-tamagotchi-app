import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen, ScreenHeader, Text, colors, radii, spacing } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import type { CharacterGrowthStage } from '@/domain/rewards';
import { CharacterAvatar } from '@/features/character';
import { isMoodLabAvailable } from '@/features/mood-lab/availability';
import {
  moodLabCharacters,
  moodLabMoods,
  moodLabStages,
  type MoodLabMood,
} from '@/features/mood-lab/catalog';

export default function MoodLabScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ character?: string; mood?: string; stage?: string }>();
  const initialCharacter = moodLabCharacters.includes(params.character as StarterAvatarKey)
    ? (params.character as StarterAvatarKey)
    : 'inci';
  const parsedStage = Number(params.stage);
  const initialStage = moodLabStages.includes(parsedStage as CharacterGrowthStage)
    ? (parsedStage as CharacterGrowthStage)
    : 0;
  const initialMood = moodLabMoods.includes(params.mood as MoodLabMood)
    ? (params.mood as MoodLabMood)
    : 'neutral';
  const [character, setCharacter] = useState<StarterAvatarKey>(initialCharacter);
  const [stage, setStage] = useState<CharacterGrowthStage>(initialStage);
  const [mood, setMood] = useState<MoodLabMood>(initialMood);

  useEffect(() => {
    if (!isMoodLabAvailable(__DEV__)) router.replace('/(parent)');
  }, []);

  if (!isMoodLabAvailable(__DEV__)) return null;

  const picker = <T extends string | number>(
    values: readonly T[],
    selected: T,
    select: (value: T) => void,
    label: (value: T) => string,
  ) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chipRow}>
        {values.map((value) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: value === selected }}
            key={String(value)}
            onPress={() => select(value)}
            style={[styles.chip, value === selected && styles.chipSelected]}
          >
            <Text style={value === selected ? styles.chipTextSelected : styles.chipText}>
              {label(value)}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <Screen style={styles.screen} testID="mood-lab-screen">
      <ScreenHeader
        backTestID="mood-lab-back-button"
        fallbackHref="/(parent)/settings"
        title={t('parent.moodLab.title')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text>{t('parent.moodLab.body')}</Text>
        <View style={styles.preview} testID="mood-lab-preview">
          <CharacterAvatar
            characterKey={character}
            growthStage={stage}
            mood={mood}
            size="hero"
            surface="plain"
          />
        </View>
        <Text style={styles.label}>{t('parent.moodLab.character')}</Text>
        {picker(moodLabCharacters, character, setCharacter, (value) =>
          t(`onboarding.character.options.${value}`),
        )}
        <Text style={styles.label}>{t('parent.moodLab.stage')}</Text>
        {picker(moodLabStages, stage, setStage, (value) => t(`parent.moodLab.stages.${value}`))}
        <Text style={styles.label}>{t('parent.moodLab.mood')}</Text>
        {picker(moodLabMoods, mood, setMood, (value) => t(`parent.moodLab.moods.${value}`))}
        <Text style={styles.disclaimer}>{t('parent.moodLab.disclaimer')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chipSelected: { backgroundColor: colors.brandPrimary },
  chipText: { color: colors.navy, fontWeight: '800' },
  chipTextSelected: { color: colors.white, fontWeight: '900' },
  content: { gap: spacing.md, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  disclaimer: { color: colors.navy, fontSize: 13, opacity: 0.72, textAlign: 'center' },
  label: { color: colors.brandPrimary, fontSize: 18, fontWeight: '900' },
  preview: {
    alignItems: 'center',
    backgroundColor: '#F4E9FF',
    borderRadius: 32,
    height: 320,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  screen: { justifyContent: 'flex-start' },
});
