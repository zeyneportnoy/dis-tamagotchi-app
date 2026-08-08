import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getChildExperienceUseCases } from '@/application/child';
import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import {
  Button,
  ErrorState,
  LoadingState,
  Screen,
  SelectionCard,
  Text,
  colors,
  minimumTouchTarget,
  radii,
  spacing,
} from '@/design-system';
import type { ProfileProgress } from '@/domain/family';
import { isLegacyAgeBand } from '@/domain/family';
import { CharacterAvatar } from '@/features/character';

type TaskCardProps = { completed: boolean; label: string; status: string; testID: string };
type HomeData = Readonly<{
  active: ChildProfileViewModel;
  profiles: readonly ChildProfileViewModel[];
  progress: ProfileProgress;
}>;

async function readHomeData(): Promise<HomeData | 'onboarding' | 'age-band-update'> {
  const familyUseCases = await getFamilyUseCases();
  const [active, profiles] = await Promise.all([
    familyUseCases.getActiveProfile(),
    familyUseCases.listProfiles(),
  ]);
  if (!active) return 'onboarding';
  if (isLegacyAgeBand(active.ageBand)) return 'age-band-update';
  const childUseCases = await getChildExperienceUseCases();
  return { active, profiles, progress: await childUseCases.getProgress(active.id) };
}

function TaskCard({ completed, label, status, testID }: TaskCardProps) {
  return (
    <View
      accessibilityLabel={`${label}. ${status}`}
      accessible
      style={[styles.taskCard, completed && styles.taskCardCompleted]}
      testID={testID}
    >
      <View style={[styles.taskIconCircle, completed && styles.taskIconCircleCompleted]}>
        <Text style={styles.taskIcon}>{completed ? '✓' : '○'}</Text>
      </View>
      <Text style={styles.taskTitle}>{label}</Text>
      <Text style={styles.taskStatus}>{status}</Text>
    </View>
  );
}

export default function ChildHomeScreen() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ChildProfileViewModel | null>(null);
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  const applyData = (data: HomeData): void => {
    setProgress(data.progress);
    setActive(data.active);
    setProfiles(data.profiles);
  };

  const load = async (): Promise<void> => {
    try {
      const data = await readHomeData();
      if (data === 'onboarding') return router.replace('/onboarding');
      if (data === 'age-band-update') return router.replace('/age-band-update' as Href);
      applyData(data);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    let mounted = true;
    void readHomeData()
      .then((data) => {
        if (!mounted) return;
        if (data === 'onboarding') return router.replace('/onboarding');
        if (data === 'age-band-update') return router.replace('/age-band-update' as Href);
        applyData(data);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (failed) return <ErrorState />;
  if (!active || !progress) return <LoadingState />;

  return (
    <Screen style={styles.screen} testID="child-home-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text variant="title">{t('childHome.title', { nickname: active.nickname })}</Text>
            <Text>{t('childHome.greeting')}</Text>
          </View>
          <Pressable
            accessibilityLabel={t('childHome.activeProfile', { nickname: active.nickname })}
            accessibilityRole="button"
            onPress={() => setPickerVisible(true)}
            style={({ pressed }) => [styles.profileTrigger, pressed && styles.pressed]}
            testID="profile-switcher-trigger"
          >
            <CharacterAvatar characterKey={active.avatarId} size="small" />
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
        </View>

        <View style={styles.characterStage}>
          <View style={styles.backBlob} />
          <View style={styles.sparkleLeft} />
          <View style={styles.sparkleRight} />
          <CharacterAvatar characterKey={active.avatarId} size="hero" />
          <View style={styles.floor} />
        </View>

        <View style={styles.taskRow}>
          <TaskCard
            completed={progress.morningCompleted}
            label={t('childHome.morning')}
            status={t(progress.morningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="morning-task"
          />
          <TaskCard
            completed={progress.eveningCompleted}
            label={t('childHome.evening')}
            status={t(progress.eveningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="evening-task"
          />
        </View>

        <Button
          label={t('childHome.brush')}
          onPress={() => router.push('/brushing')}
          testID="brush-button"
        />
        <Text style={styles.streak}>
          {t('childHome.streak', { count: progress.currentStreak })}
        </Text>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
        transparent
        visible={pickerVisible}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard} testID="profile-switcher-modal">
            <View style={styles.modalHeader}>
              <Text variant="title">{t('childHome.profilePickerTitle')}</Text>
              <Pressable
                accessibilityLabel={t('navigation.close')}
                accessibilityRole="button"
                onPress={() => setPickerVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
            </View>
            {profiles.map((profile) => (
              <SelectionCard
                key={profile.id}
                label={profile.nickname}
                onPress={() => {
                  setPickerVisible(false);
                  void getFamilyUseCases()
                    .then((useCases) => useCases.selectActiveProfile(profile.id))
                    .then(load);
                }}
                selected={profile.id === active.id}
              />
            ))}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBlob: {
    backgroundColor: '#F0EAFE',
    borderRadius: radii.pill,
    height: 260,
    position: 'absolute',
    width: 290,
  },
  characterStage: { alignItems: 'center', height: 280, justifyContent: 'center' },
  chevron: { color: colors.brandPrimary, fontSize: 24, fontWeight: '800', lineHeight: 26 },
  closeButton: {
    alignItems: 'center',
    height: minimumTouchTarget,
    justifyContent: 'center',
    width: minimumTouchTarget,
  },
  closeIcon: { color: colors.brandPrimary, fontSize: 34, lineHeight: 38 },
  content: { flexGrow: 1, gap: spacing.md, paddingBottom: spacing.md },
  floor: {
    backgroundColor: colors.brandAccent,
    borderRadius: radii.pill,
    bottom: 4,
    height: 24,
    opacity: 0.3,
    position: 'absolute',
    width: 220,
  },
  greeting: { flex: 1, gap: spacing.xs },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  modalBackdrop: {
    backgroundColor: 'rgba(38, 50, 56, 0.35)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.backgroundBase,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pressed: { opacity: 0.75 },
  profileTrigger: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: minimumTouchTarget,
    paddingLeft: spacing.xs,
  },
  screen: { justifyContent: 'flex-start' },
  sparkleLeft: {
    backgroundColor: colors.brandSecondary,
    borderRadius: radii.pill,
    height: 18,
    left: 16,
    position: 'absolute',
    top: 42,
    width: 18,
  },
  sparkleRight: {
    backgroundColor: colors.brandHighlight,
    borderRadius: radii.pill,
    height: 26,
    position: 'absolute',
    right: 12,
    top: 78,
    width: 26,
  },
  streak: { color: colors.brandPrimary, fontWeight: '700', textAlign: 'center' },
  taskCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.brandHighlight,
    borderRadius: radii.md,
    borderWidth: 2,
    flex: 1,
    minHeight: 112,
    padding: spacing.sm,
  },
  taskCardCompleted: { borderColor: colors.brandAccent },
  taskIcon: { color: colors.brandPrimary, fontSize: 24, fontWeight: '800', lineHeight: 28 },
  taskIconCircle: {
    alignItems: 'center',
    backgroundColor: '#FFF4CF',
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  taskIconCircleCompleted: { backgroundColor: '#DDF8F3' },
  taskRow: { flexDirection: 'row', gap: spacing.sm },
  taskStatus: { fontSize: 15, lineHeight: 20, textAlign: 'center' },
  taskTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22, textAlign: 'center' },
});
