import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import {
  Button,
  ErrorState,
  LoadingState,
  Screen,
  Text,
  colors,
  radii,
  spacing,
} from '@/design-system';
import {
  CharacterAvatar,
  CharacterSceneDecor,
  CharacterScreenBackdrop,
  sceneBackgroundForCharacter,
  sceneToneForCharacter,
} from '@/features/character';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getFamilyUseCases()
        .then((useCases) => useCases.getActiveProfile())
        .then((active) => {
          if (mounted) setProfile(active);
        })
        .catch(() => {
          if (mounted) setFailed(true);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  if (failed) return <ErrorState />;
  if (!profile) return <LoadingState />;

  return (
    <Screen
      style={[styles.screen, { backgroundColor: sceneBackgroundForCharacter(profile.avatarId) }]}
      testID="profile-screen"
    >
      <CharacterScreenBackdrop characterKey={profile.avatarId} />
      <Text style={styles.heading} variant="title">
        {t('placeholders.profileTitle')}
      </Text>
      <View style={styles.hero}>
        <CharacterSceneDecor density="calm" tone={sceneToneForCharacter(profile.avatarId)} />
        <Text style={styles.sparkleLeft}>✦</Text>
        <Text style={styles.sparkleRight}>★</Text>
        <CharacterAvatar characterKey={profile.avatarId} size="large" surface="plain" />
        <View style={styles.pedestal} />
      </View>
      <Text style={styles.nickname}>{profile.nickname}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.nickname')}</Text>
          <Text>{profile.nickname}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.ageBand')}</Text>
          <Text>
            {t(
              profile.ageBand === '7_11'
                ? 'onboarding.ageBand.sevenEleven'
                : 'onboarding.ageBand.fourSix',
            )}
          </Text>
        </View>
      </View>
      <Button
        label={t('childHome.parentArea')}
        onPress={() => router.push('/parent-gate')}
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  heading: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    backgroundColor: '#BFEFEB',
    borderRadius: 34,
    height: 290,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  label: { flex: 1, fontWeight: '800' },
  nickname: { fontSize: 26, fontWeight: '900', lineHeight: 32 },
  pedestal: {
    backgroundColor: '#A16DCE',
    borderRadius: radii.pill,
    height: 24,
    marginTop: -28,
    width: 150,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  screen: { alignItems: 'center', gap: spacing.md },
  sparkleLeft: {
    color: colors.brandHighlight,
    fontSize: 28,
    left: spacing.lg,
    position: 'absolute',
    top: spacing.lg,
  },
  sparkleRight: {
    color: colors.brandSecondary,
    fontSize: 28,
    position: 'absolute',
    right: spacing.lg,
    top: 60,
  },
});
