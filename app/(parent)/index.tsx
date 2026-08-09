import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StyleSheet, View } from 'react-native';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import { BackButton, Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { useAuth } from '@/features/auth';

export default function ParentAccountScreen() {
  const { t } = useTranslation();
  const { session, useCases } = useAuth();
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[]>([]);
  const [deleteInfo, setDeleteInfo] = useState(false);

  useEffect(() => {
    void getFamilyUseCases()
      .then((family) => family.listProfiles())
      .then(setProfiles);
  }, []);

  const signOut = async (): Promise<void> => {
    await useCases?.signOut();
    router.replace('/auth/login');
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.back}>
        <BackButton onPress={() => router.replace('/(child)/profile')} />
      </View>
      <Text variant="title">{t('parent.accountTitle')}</Text>
      <View style={styles.accountCard}>
        <Text style={styles.name}>{session?.displayName || t('parent.title')}</Text>
        <Text>{session?.email}</Text>
        <Text>{t(session?.emailVerified ? 'parent.verified' : 'parent.unverified')}</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.name}>{t('parent.children')}</Text>
        {profiles.map((profile) => (
          <Text key={profile.id}>• {profile.nickname}</Text>
        ))}
      </View>
      <Button label={t('parent.addProfile')} onPress={() => router.push('/onboarding/nickname')} />
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
  back: { left: spacing.lg, position: 'absolute', top: spacing.xl + spacing.lg },
  name: { fontWeight: '900' },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  screen: { justifyContent: 'flex-start', paddingTop: 96 },
  warning: { backgroundColor: '#FFF0C9', borderRadius: radii.md, padding: spacing.md },
});
