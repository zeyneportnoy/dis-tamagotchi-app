import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { CharacterAvatar } from '@/features/character';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then((active) => setProfile(active))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <ErrorState />;
  if (!profile) return <LoadingState />;

  return (
    <Screen style={styles.screen} testID="profile-screen">
      <CharacterAvatar characterKey={profile.avatarId} />
      <View style={styles.card}>
        <Text variant="title">{t('placeholders.profileTitle')}</Text>
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
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  label: { fontWeight: '800' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  screen: { alignItems: 'center' },
});
