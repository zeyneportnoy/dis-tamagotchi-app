import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  radii,
  spacing,
} from '@/design-system';
import type { BrushingPeriod, ProfileProgress } from '@/domain/family';
import { isLegacyAgeBand } from '@/domain/family';
import { CharacterAvatar } from '@/features/character';

type TaskCardProps = {
  completed: boolean;
  label: string;
  onPress: () => void;
  status: string;
  testID: string;
};

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

function TaskCard({ completed, label, onPress, status, testID }: TaskCardProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      onPress={onPress}
      style={[styles.taskCard, completed && styles.taskCardCompleted]}
      testID={testID}
    >
      <Text style={styles.taskIcon}>{completed ? '✓' : '○'}</Text>
      <View style={styles.taskCopy}>
        <Text style={styles.taskTitle}>{label}</Text>
        <Text style={styles.taskStatus}>{status}</Text>
      </View>
    </Pressable>
  );
}

export default function ChildHomeScreen() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ChildProfileViewModel | null>(null);
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [failed, setFailed] = useState(false);

  const load = async (): Promise<void> => {
    try {
      const data = await readHomeData();
      if (data === 'onboarding') return router.replace('/onboarding');
      if (data === 'age-band-update') return router.replace('/age-band-update' as Href);
      setProgress(data.progress);
      setActive(data.active);
      setProfiles(data.profiles);
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
        setProgress(data.progress);
        setActive(data.active);
        setProfiles(data.profiles);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleTask = async (period: BrushingPeriod, completed: boolean): Promise<void> => {
    if (!active) return;
    const useCases = await getChildExperienceUseCases();
    setProgress(await useCases.setBrushingCompleted(active.id, period, !completed));
  };

  if (failed) return <ErrorState />;
  if (!active || !progress) return <LoadingState />;

  return (
    <Screen style={styles.screen} testID="child-home-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View>
            <Text variant="title">{t('childHome.title', { nickname: active.nickname })}</Text>
            <Text>{t('childHome.greeting')}</Text>
          </View>
          <CharacterAvatar characterKey={active.avatarId} size="small" />
        </View>

        {profiles.length > 1 ? (
          <View style={styles.profileSwitcher}>
            <Text style={styles.sectionLabel}>{t('childHome.switchProfile')}</Text>
            {profiles.map((profile) => (
              <SelectionCard
                key={profile.id}
                label={profile.nickname}
                onPress={() => {
                  void getFamilyUseCases()
                    .then((useCases) => useCases.selectActiveProfile(profile.id))
                    .then(load);
                }}
                selected={profile.id === active.id}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.characterStage}>
          <CharacterAvatar characterKey={active.avatarId} />
          <Text style={styles.goal}>{t('childHome.todayGoal')}</Text>
        </View>

        <View style={styles.taskRow}>
          <TaskCard
            completed={progress.morningCompleted}
            label={t('childHome.morning')}
            onPress={() => void toggleTask('morning', progress.morningCompleted)}
            status={t(progress.morningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="morning-task"
          />
          <TaskCard
            completed={progress.eveningCompleted}
            label={t('childHome.evening')}
            onPress={() => void toggleTask('evening', progress.eveningCompleted)}
            status={t(progress.eveningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="evening-task"
          />
        </View>

        <Button label={t('childHome.brush')} onPress={() => undefined} testID="brush-button" />
        <Text style={styles.streak}>
          {t('childHome.streak', { count: progress.currentStreak })}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  characterStage: { alignItems: 'center', gap: spacing.md },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  goal: { fontWeight: '600', textAlign: 'center' },
  profileHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profileSwitcher: { gap: spacing.sm },
  screen: { justifyContent: 'flex-start' },
  sectionLabel: { fontWeight: '700' },
  streak: { color: colors.brandPrimary, fontWeight: '700', textAlign: 'center' },
  taskCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.brandHighlight,
    borderRadius: radii.md,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    minHeight: 88,
    padding: spacing.md,
  },
  taskCardCompleted: { borderColor: colors.brandAccent },
  taskCopy: { flex: 1 },
  taskIcon: { color: colors.brandPrimary, fontSize: 28, marginRight: spacing.sm },
  taskRow: { flexDirection: 'row', gap: spacing.sm },
  taskStatus: { fontSize: 14, lineHeight: 20 },
  taskTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
});
