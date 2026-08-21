import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Screen, Text, colors, radii, spacing } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import { sceneBackgroundForCharacter } from '@/features/character';

export default function TasksScreen() {
  const { t } = useTranslation();
  const [characterKey, setCharacterKey] = useState<StarterAvatarKey>('inci');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getFamilyUseCases()
        .then((family) => family.getActiveProfile())
        .then((profile) => {
          if (mounted && profile) setCharacterKey(profile.avatarId);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );
  return (
    <Screen
      style={[styles.screen, { backgroundColor: sceneBackgroundForCharacter(characterKey) }]}
      testID="tasks-screen"
    >
      <Text style={styles.heading} variant="title">
        {t('placeholders.tasksTitle')}
      </Text>
      <View style={styles.hero}>
        <View style={styles.iconBubble}>
          <Text style={styles.icon}>🪥</Text>
        </View>
        <Text style={styles.sparkle}>✦</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.check}>
          <Text style={styles.checkText}>✓</Text>
        </View>
        <Text>{t('placeholders.tasksBody')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  check: {
    alignItems: 'center',
    backgroundColor: '#DDF8F3',
    borderRadius: radii.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  checkText: { color: colors.brandPrimary, fontSize: 26, fontWeight: '900', lineHeight: 30 },
  heading: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    backgroundColor: '#D9C7FF',
    borderRadius: 34,
    height: 300,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: { fontSize: 76, lineHeight: 88 },
  iconBubble: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 150,
    justifyContent: 'center',
    width: 150,
  },
  screen: { justifyContent: 'center' },
  sparkle: {
    color: colors.brandHighlight,
    fontSize: 32,
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
  },
});
