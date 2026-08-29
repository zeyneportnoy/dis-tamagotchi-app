import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import { resetSessionSyncState, wipeLocalAccountData } from '@/application/sync';
import { Button, Screen, ScreenHeader, Text, colors, radii, spacing } from '@/design-system';
import { useAuth } from '@/features/auth';
import { deleteCustomizationState } from '@/features/customization';
import { starterAvatarKeys } from '@/domain/family';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function ParentAccountScreen() {
  const { t } = useTranslation();
  const { session, useCases } = useAuth();
  const draft = useOnboardingDraft();
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChildProfileViewModel | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState(false);

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
    const dateOfBirth = profile.dateOfBirth;
    const ageBand =
      profile.ageBand === '4_6' || profile.ageBand === '7_11' ? profile.ageBand : null;
    const avatarId = starterAvatarKeys.includes(profile.avatarId) ? profile.avatarId : null;
    if (nickname && dateOfBirth && ageBand && avatarId) {
      draft.reset();
      router.replace('/(child)');
      return;
    }

    draft.beginExistingProfile({
      id: profile.id,
      nickname,
      dateOfBirth,
      ageBand,
      avatarId,
    });
    if (!nickname) return router.replace('/onboarding/nickname');
    if (!dateOfBirth || !ageBand) return router.replace('/onboarding/age-band');
    router.replace('/onboarding/character');
  };

  const signOut = async (): Promise<void> => {
    await useCases?.signOut();
    resetSessionSyncState();
    router.replace('/auth/login');
  };

  const confirmDeleteAccount = async (): Promise<void> => {
    if (deletingAccount) return;
    const parentUserId = session?.userId;
    setDeletingAccount(true);
    setDeleteAccountError(false);
    try {
      await useCases?.deleteAccount();
      if (parentUserId) await wipeLocalAccountData(parentUserId);
      resetSessionSyncState();
      draft.reset();
      setDeleteAccountOpen(false);
      router.replace('/onboarding');
    } catch {
      setDeleteAccountError(true);
    } finally {
      setDeletingAccount(false);
    }
  };

  const deleteSelectedProfile = async (): Promise<void> => {
    if (!deleteTarget || deletingProfile) return;
    const profileId = deleteTarget.id;
    const deletingActiveProfile = profileId === activeProfileId;
    setDeletingProfile(true);
    try {
      const family = await getFamilyUseCases();
      await family.deleteProfile(profileId);
      await deleteCustomizationState(profileId);
      const remainingProfiles = await family.listProfiles();
      setProfiles(remainingProfiles);
      setDeleteTarget(null);

      if (!deletingActiveProfile) return;
      const fallbackProfile = remainingProfiles[0];
      if (fallbackProfile) {
        await family.selectActiveProfile(fallbackProfile.id);
        setActiveProfileId(fallbackProfile.id);
        return;
      }

      setActiveProfileId(null);
      draft.reset();
      router.replace('/onboarding/nickname');
    } finally {
      setDeletingProfile(false);
    }
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
          {profiles.map((profile) => {
            const selected = profile.id === activeProfileId;
            return (
              <View
                key={profile.id}
                style={[styles.profileRow, selected && styles.profileRowSelected]}
              >
                <Pressable
                  accessibilityLabel={profile.nickname}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => void selectProfile(profile)}
                  style={({ pressed }) => [
                    styles.profileSelection,
                    pressed && styles.profileSelectionPressed,
                  ]}
                  testID={`parent-child-profile-${profile.id}`}
                >
                  <Text style={styles.profileName}>{profile.nickname}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={t('parent.deleteChild.action', { name: profile.nickname })}
                  accessibilityRole="button"
                  hitSlop={4}
                  onPress={(event: GestureResponderEvent) => {
                    event.stopPropagation();
                    setDeleteTarget(profile);
                  }}
                  style={({ pressed }) => [
                    styles.profileDelete,
                    selected && styles.profileDeleteSelected,
                    pressed && styles.profileDeletePressed,
                  ]}
                  testID={`delete-child-profile-${profile.id}`}
                >
                  <View style={styles.trashIcon}>
                    <View style={[styles.trashHandle, selected && styles.trashHandleSelected]} />
                    <View style={[styles.trashLid, selected && styles.trashLidSelected]} />
                    <View style={[styles.trashBody, selected && styles.trashBodySelected]}>
                      <View style={styles.trashLines}>
                        <View style={[styles.trashLine, selected && styles.trashLineSelected]} />
                        <View style={[styles.trashLine, selected && styles.trashLineSelected]} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })}
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
          onPress={() => setDeleteAccountOpen(true)}
          testID="delete-account-button"
          variant="secondary"
        />
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deletingAccount) setDeleteAccountOpen(false);
        }}
        transparent
        visible={deleteAccountOpen}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard} testID="delete-account-modal">
            <Text style={styles.modalTitle}>{t('parent.deleteAccountModal.title')}</Text>
            <Text>{t('parent.deleteAccountModal.message')}</Text>
            {deleteAccountError ? (
              <Text style={styles.deleteError}>{t('parent.deleteAccountModal.error')}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <View style={styles.modalAction}>
                <Button
                  disabled={deletingAccount}
                  label={t('parent.deleteAccountModal.cancel')}
                  onPress={() => setDeleteAccountOpen(false)}
                  variant="secondary"
                />
              </View>
              <View style={styles.modalAction}>
                <Button
                  disabled={deletingAccount}
                  label={t('parent.deleteAccountModal.confirm')}
                  onPress={() => void confirmDeleteAccount()}
                  testID="delete-account-confirm"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deletingProfile) setDeleteTarget(null);
        }}
        transparent
        visible={deleteTarget !== null}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('parent.deleteChild.title')}</Text>
            <Text>{t('parent.deleteChild.message', { name: deleteTarget?.nickname ?? '' })}</Text>
            <View style={styles.modalActions}>
              <View style={styles.modalAction}>
                <Button
                  disabled={deletingProfile}
                  label={t('parent.deleteChild.cancel')}
                  onPress={() => setDeleteTarget(null)}
                  variant="secondary"
                />
              </View>
              <View style={styles.modalAction}>
                <Button
                  disabled={deletingProfile}
                  label={t('parent.deleteChild.confirm')}
                  onPress={() => void deleteSelectedProfile()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  deleteError: { color: colors.brandSecondary, fontWeight: '800' },
  modalAction: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(38,50,56,0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.lg,
    width: '100%',
  },
  modalTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900' },
  name: { fontWeight: '900' },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  profileDelete: {
    alignItems: 'center',
    backgroundColor: '#FFF1F5',
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 44,
  },
  profileDeletePressed: { opacity: 0.68 },
  profileDeleteSelected: { backgroundColor: '#E5FAF7' },
  profileName: { fontSize: 17 },
  profileRow: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.brandPrimary,
    borderRadius: radii.md,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: 64,
    overflow: 'hidden',
  },
  profileRowSelected: { backgroundColor: '#E7E7FC', borderColor: colors.teal },
  profileSelection: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  profileSelectionPressed: { opacity: 0.72 },
  screen: { justifyContent: 'flex-start' },
  trashBody: {
    alignItems: 'center',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderColor: colors.brandPrimary,
    borderTopWidth: 0,
    borderWidth: 1.5,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  trashBodySelected: { borderColor: colors.teal },
  trashHandle: {
    borderColor: colors.brandPrimary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderWidth: 1.5,
    height: 4,
    marginBottom: 1,
    width: 7,
  },
  trashHandleSelected: { borderColor: colors.teal },
  trashIcon: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
  trashLid: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radii.pill,
    height: 2,
    marginBottom: 1,
    width: 18,
  },
  trashLidSelected: { backgroundColor: colors.teal },
  trashLine: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radii.pill,
    height: 8,
    width: 1.5,
  },
  trashLineSelected: { backgroundColor: colors.teal },
  trashLines: { flexDirection: 'row', gap: 3 },
});
