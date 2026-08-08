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

type TaskCardProps = {
  completed: boolean;
  icon: string;
  label: string;
  tone: 'morning' | 'evening';
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

function TaskCard({ completed, icon, label, status, testID, tone }: TaskCardProps) {
  return (
    <View
      accessibilityLabel={`${label}. ${status}`}
      accessible
      style={[styles.taskCard, tone === 'morning' ? styles.morningCard : styles.eveningCard]}
      testID={testID}
    >
      <View style={styles.taskTopRow}>
        <Text style={styles.taskIcon}>{icon}</Text>
        <View style={[styles.statusDot, completed && styles.statusDotCompleted]}>
          <Text style={styles.statusIcon}>{completed ? '✓' : '•'}</Text>
        </View>
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
          </View>
          <Pressable
            accessibilityLabel={t('childHome.activeProfile', { nickname: active.nickname })}
            accessibilityRole="button"
            onPress={() => setPickerVisible(true)}
            style={({ pressed }) => [styles.profileTrigger, pressed && styles.pressed]}
            testID="profile-switcher-trigger"
          >
            <CharacterAvatar characterKey={active.avatarId} size="tiny" />
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
        </View>

        <View style={styles.characterStage}>
          <View style={styles.window}>
            <View style={styles.windowVertical} />
            <View style={styles.windowHorizontal} />
            <View style={styles.cloudOne} />
            <View style={styles.cloudTwo} />
            <View style={styles.windowHill} />
          </View>
          <View style={styles.pictureFrame}>
            <View style={styles.pictureSky}>
              <Text style={styles.pictureIcon}>✦</Text>
            </View>
          </View>
          <View style={styles.floor}>
            <View style={[styles.floorLine, styles.floorLineOne]} />
            <View style={[styles.floorLine, styles.floorLineTwo]} />
            <View style={[styles.floorLine, styles.floorLineThree]} />
          </View>
          <View style={[styles.plant, styles.plantLeft]}>
            <View style={[styles.leaf, styles.leafLeft]} />
            <View style={[styles.leaf, styles.leafRight]} />
            <View style={styles.pot} />
          </View>
          <View style={[styles.plant, styles.plantRight]}>
            <View style={[styles.leaf, styles.leafLeft]} />
            <View style={[styles.leaf, styles.leafRight]} />
            <View style={styles.pot} />
          </View>
          <View style={styles.rug} />
          <Text style={[styles.sceneSparkle, styles.sceneSparkleLeft]}>✦</Text>
          <Text style={[styles.sceneSparkle, styles.sceneSparkleRight]}>✦</Text>
          <View style={styles.heroCharacter}>
            <CharacterAvatar characterKey={active.avatarId} size="hero" surface="plain" />
          </View>
        </View>

        <View style={styles.primaryAction}>
          <Button
            label={t('childHome.brush')}
            onPress={() => router.push('/brushing')}
            testID="brush-button"
          />
        </View>

        <View style={styles.taskRow}>
          <TaskCard
            completed={progress.morningCompleted}
            icon="☀️"
            label={t('childHome.morning')}
            status={t(progress.morningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="morning-task"
            tone="morning"
          />
          <TaskCard
            completed={progress.eveningCompleted}
            icon="🌙"
            label={t('childHome.evening')}
            status={t(progress.eveningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="evening-task"
            tone="evening"
          />
        </View>
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
  characterStage: {
    alignItems: 'center',
    backgroundColor: '#FADFE4',
    borderColor: colors.white,
    borderRadius: 32,
    borderWidth: 4,
    height: 336,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#A64C72',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  chevron: { color: colors.brandPrimary, fontSize: 24, fontWeight: '800', lineHeight: 26 },
  cloudOne: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    bottom: 20,
    height: 16,
    left: 15,
    opacity: 0.82,
    position: 'absolute',
    width: 44,
  },
  cloudTwo: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    bottom: 30,
    height: 20,
    left: 32,
    opacity: 0.82,
    position: 'absolute',
    width: 34,
  },
  closeButton: {
    alignItems: 'center',
    height: minimumTouchTarget,
    justifyContent: 'center',
    width: minimumTouchTarget,
  },
  closeIcon: { color: colors.brandPrimary, fontSize: 34, lineHeight: 38 },
  content: { flexGrow: 1, gap: 12, paddingBottom: spacing.md },
  eveningCard: { backgroundColor: '#EEE9FF' },
  floor: {
    backgroundColor: '#F4C7B4',
    bottom: 0,
    height: 104,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  floorLine: {
    backgroundColor: 'rgba(176, 110, 95, 0.16)',
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 2,
  },
  floorLineOne: { left: '25%' },
  floorLineThree: { left: '75%' },
  floorLineTwo: { left: '50%' },
  greeting: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 66 },
  heroCharacter: { bottom: 24, position: 'absolute' },
  leaf: {
    backgroundColor: colors.brandAccent,
    borderRadius: radii.pill,
    height: 34,
    position: 'absolute',
    top: 0,
    width: 18,
  },
  leafLeft: { left: 3, transform: [{ rotate: '-28deg' }] },
  leafRight: { right: 3, transform: [{ rotate: '28deg' }] },
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
  primaryAction: {
    borderRadius: radii.lg,
    shadowColor: colors.brandPrimary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  profileTrigger: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: minimumTouchTarget,
    paddingLeft: spacing.xs,
  },
  pictureFrame: {
    alignItems: 'center',
    backgroundColor: '#EFB5A8',
    borderRadius: radii.sm,
    height: 72,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    top: 34,
    width: 58,
  },
  pictureIcon: { color: colors.brandSecondary, fontSize: 24, lineHeight: 28 },
  pictureSky: {
    alignItems: 'center',
    backgroundColor: '#FFF0CF',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 40,
  },
  plant: { bottom: 38, height: 70, position: 'absolute', width: 54 },
  plantLeft: { left: 18 },
  plantRight: { right: 18, transform: [{ scale: 0.88 }] },
  pot: {
    backgroundColor: colors.brandSecondary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    bottom: 0,
    height: 34,
    left: 8,
    position: 'absolute',
    width: 38,
  },
  rug: {
    backgroundColor: '#F59AC0',
    borderColor: '#FBC9DC',
    borderRadius: radii.pill,
    borderWidth: 8,
    bottom: 18,
    height: 50,
    position: 'absolute',
    width: 224,
  },
  sceneSparkle: {
    color: colors.brandHighlight,
    fontSize: 22,
    lineHeight: 26,
    position: 'absolute',
  },
  sceneSparkleLeft: { left: 38, top: 126 },
  sceneSparkleRight: { right: 38, top: 132 },
  screen: { justifyContent: 'flex-start' },
  statusDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: radii.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  statusDotCompleted: { backgroundColor: colors.brandAccent },
  statusIcon: { color: colors.brandPrimary, fontSize: 18, fontWeight: '900', lineHeight: 22 },
  streak: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    opacity: 0.55,
    textAlign: 'center',
  },
  taskCard: {
    alignItems: 'flex-start',
    borderRadius: 24,
    flex: 1,
    minHeight: 118,
    padding: 14,
  },
  taskIcon: { fontSize: 25, lineHeight: 30 },
  taskRow: { flexDirection: 'row', gap: spacing.sm },
  taskStatus: { fontSize: 14, lineHeight: 19, opacity: 0.72 },
  taskTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  taskTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  window: {
    backgroundColor: '#AEE7ED',
    borderColor: colors.white,
    borderRadius: 18,
    borderWidth: 6,
    height: 108,
    left: 24,
    overflow: 'hidden',
    position: 'absolute',
    top: 28,
    width: 116,
  },
  windowHorizontal: {
    backgroundColor: colors.white,
    height: 5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 43,
  },
  windowVertical: {
    backgroundColor: colors.white,
    bottom: 0,
    left: 47,
    position: 'absolute',
    top: 0,
    width: 5,
  },
  windowHill: {
    backgroundColor: '#8AD7B8',
    borderRadius: radii.pill,
    bottom: -23,
    height: 48,
    left: -12,
    position: 'absolute',
    transform: [{ rotate: '8deg' }],
    width: 120,
  },
  morningCard: { backgroundColor: '#FFF0C9' },
});
