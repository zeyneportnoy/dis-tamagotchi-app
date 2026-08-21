import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ScrollView, StyleSheet, View } from 'react-native';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import {
  Button,
  Screen,
  ScreenHeader,
  SelectionCard,
  Text,
  colors,
  radii,
  spacing,
} from '@/design-system';
import { useAuth } from '@/features/auth';
import { starterAvatarKeys } from '@/domain/family';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function ParentAccountScreen() {
  const { t } = useTranslation();
  const { session, useCases } = useAuth();
  const draft = useOnboardingDraft();
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [deleteInfo, setDeleteInfo] = useState(false);

  useEffect(() => {
    void getFamilyUseCases().then(async (family) => {
      const [listedProfiles, activeProfile] = await Promise.all([
        family.listProfiles(),
        family.getActiveProfile(),
      ]);
      setProfiles(listedProfiles);
      setActiveProfileId(activeProfile?.id ?? null);
    });
  }, []);

  const selectProfile = async (profile: ChildProfileViewModel): Promise<void> => {
    const family = await getFamilyUseCases();
    await family.selectActiveProfile(profile.id);
    setActiveProfileId(profile.id);

    const nickname = profile.nickname?.trim();
    const ageBand =
      profile.ageBand === '4_6' || profile.ageBand === '7_11' ? profile.ageBand : null;
    const avatarId = starterAvatarKeys.includes(profile.avatarId) ? profile.avatarId : null;
    if (nickname && ageBand && avatarId) {
      draft.reset();
      router.replace('/(child)');
      return;
    }

    draft.beginExistingProfile({
      id: profile.id,
      nickname,
      ageBand,
      avatarId,
    });
    if (!nickname) return router.replace('/onboarding/nickname');
    if (!ageBand) return router.replace('/onboarding/age-band');
    router.replace('/onboarding/character');
  };

  const signOut = async (): Promise<void> => {
    await useCases?.signOut();
    router.replace('/auth/login');
  };

  return (
    <Screen style={styles.screen} testID="parent-account-screen">
      <ScreenHeader
        backTestID="parent-account-back-button"
        fallbackHref="/(child)/profile"
        onBackPress={() => router.replace('/(child)/profile')}
        title={t('parent.accountTitle')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.accountCard}>
          <Text style={styles.name}>{session?.displayName || t('parent.title')}</Text>
          <Text>{session?.email}</Text>
          <Text>{t(session?.emailVerified ? 'parent.verified' : 'parent.unverified')}</Text>
        </View>
        <View style={styles.profileCard}>
          <Text style={styles.name}>{t('parent.children')}</Text>
          {profiles.map((profile) => (
            <SelectionCard
              key={profile.id}
              label={profile.nickname}
              onPress={() => void selectProfile(profile)}
              selected={profile.id === activeProfileId}
              testID={`parent-child-profile-${profile.id}`}
            />
          ))}
        </View>
        <Button
          label={t('parent.settings.open')}
          onPress={() => router.push('/(parent)/settings')}
          variant="secondary"
        />
        <Button
          label={t('parent.addProfile')}
          onPress={() => router.push('/onboarding/nickname')}
        />
        <Button
          label={t('parent.changePassword')}
          onPress={() => router.push('/auth/forgot-password')}
          variant="secondary"
        />
        <Button label={t('parent.signOut')} onPress={() => void signOut()} variant="secondary" />
        <Button
          label={t('parent.deleteAccount')}
          onPress={() => setDeleteInfo(true)}
          variant="secondary"
        />
        {deleteInfo ? (
          <View style={styles.warning}>
            <Text>{t('parent.deleteUnavailable')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    backgroundColor: '#DDF8F3',
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  name: { fontWeight: '900' },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  screen: { justifyContent: 'flex-start' },
  warning: { backgroundColor: '#FFF0C9', borderRadius: radii.md, padding: spacing.md },
});
