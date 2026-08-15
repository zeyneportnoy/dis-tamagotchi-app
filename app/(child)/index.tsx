import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import {
  characterGrowthStageNames,
  estimatedBrushingsToNextStage,
  growthProgressForXp,
  type InventoryItem,
} from '@/domain/rewards';
import { CharacterAvatar } from '@/features/character';

type TaskCardProps = {
  completed: boolean;
  icon: string;
  label: string;
  tone: 'morning' | 'evening';
  status: string;
  testID: string;
  onPress(): void;
  onReminderPress(): void;
  reminderLabel: string;
};
type HomeData = Readonly<{
  active: ChildProfileViewModel;
  profiles: readonly ChildProfileViewModel[];
  progress: ProfileProgress;
  equipped: readonly InventoryItem[];
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
  const [progress, equipped] = await Promise.all([
    childUseCases.getProgress(active.id),
    childUseCases.getEquippedItems
      ? childUseCases.getEquippedItems(active.id)
      : childUseCases.getEquippedItem
        ? childUseCases.getEquippedItem(active.id).then((item) => (item ? [item] : []))
        : Promise.resolve([]),
  ]);
  return { active, equipped, profiles, progress };
}

function TaskCard({
  completed,
  icon,
  label,
  onPress,
  onReminderPress,
  reminderLabel,
  status,
  testID,
  tone,
}: TaskCardProps) {
  return (
    <View style={styles.taskCardShell}>
      <Pressable
        accessibilityLabel={`${label}. ${status}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.taskCard,
          tone === 'morning' ? styles.morningCard : styles.eveningCard,
          completed && styles.taskCardCompleted,
          pressed && styles.pressed,
        ]}
        testID={testID}
      >
        <Text style={styles.taskIcon}>{icon}</Text>
        <Text style={styles.taskTitle}>{label}</Text>
        <View style={[styles.statusDot, completed && styles.statusDotCompleted]}>
          <Text style={styles.statusIcon}>{completed ? '✓' : '○'}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={reminderLabel}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onReminderPress}
        style={styles.reminderBell}
      >
        <Text style={styles.reminderBellIcon}>🔔</Text>
      </Pressable>
    </View>
  );
}

export default function ChildHomeScreen() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ChildProfileViewModel | null>(null);
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [equipped, setEquipped] = useState<readonly InventoryItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  const applyData = (data: HomeData): void => {
    setProgress(data.progress);
    setEquipped(data.equipped);
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

  useFocusEffect(
    useCallback(() => {
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
    }, []),
  );

  if (failed) return <ErrorState />;
  if (!active || !progress) return <LoadingState />;
  const growth = growthProgressForXp(progress.totalXp);
  const growthStage = growth.currentStage;
  const isYoungerExperience = active.ageBand === '4_6';
  const roomBackground = equipped.find((item) => item.slot === 'background');
  const roomDecor = equipped.find((item) => item.slot === 'decor');
  const roomEffect = equipped.find((item) => item.slot === 'effect');
  const roomTone =
    roomBackground?.key === 'space-room' || roomBackground?.key === 'night-room'
      ? '#343064'
      : roomBackground?.key === 'forest-room'
        ? '#D6EDCE'
        : roomBackground?.key === 'undersea-room'
          ? '#BCECE8'
          : roomBackground?.key === 'rainbow-cape' || roomBackground?.key === 'rainbow-room'
            ? '#F4D7F5'
            : roomBackground
              ? '#E9E0FF'
              : undefined;

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
            <CharacterAvatar characterKey={active.avatarId} growthStage={growthStage} size="tiny" />
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
        </View>

        <View style={[styles.characterStage, roomTone ? { backgroundColor: roomTone } : null]}>
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
          {roomEffect ? (
            <View pointerEvents="none" style={styles.selectedRoomEffect}>
              <Text style={styles.effectOne}>{roomEffect.icon}</Text>
              <Text style={styles.effectTwo}>{roomEffect.icon}</Text>
              <Text style={styles.effectThree}>{roomEffect.icon}</Text>
            </View>
          ) : null}
          {roomDecor ? (
            <Text
              style={[
                styles.selectedRoomDecor,
                roomDecor.key === 'cozy-scarf' && styles.selectedCloudCushion,
              ]}
            >
              {roomDecor.icon}
            </Text>
          ) : null}
          <Text style={[styles.sceneSparkle, styles.sceneSparkleLeft]}>✦</Text>
          <Text style={[styles.sceneSparkle, styles.sceneSparkleRight]}>✦</Text>
          <View style={styles.heroCharacter}>
            <CharacterAvatar
              accessoryKeys={equipped
                .filter((item) => item.slot === 'wearable')
                .map((item) => item.key)}
              characterKey={active.avatarId}
              growthStage={growthStage}
              mood={
                progress.morningCompleted && progress.eveningCompleted
                  ? 'proud'
                  : progress.morningCompleted || progress.eveningCompleted
                    ? 'happy'
                    : 'sleepy'
              }
              size="hero"
              surface="plain"
            />
          </View>
        </View>

        <View style={styles.growthCard}>
          <View style={styles.growthCopy}>
            <Text style={styles.levelLabel}>
              {t(`growth.stages.${characterGrowthStageNames[growthStage]}`)}
            </Text>
            <Text style={styles.xpLabel}>
              {growth.isFinalStage
                ? t('growth.finalStageShort')
                : t('growth.remainingXp', {
                    count: growth.remainingXp,
                    stage: t(`growth.stages.${characterGrowthStageNames[growth.nextStage!]}`),
                  })}
            </Text>
            {!growth.isFinalStage ? (
              <Text style={styles.brushingEstimate}>
                {t('growth.remainingBrushesApprox', {
                  count: estimatedBrushingsToNextStage(progress.totalXp),
                })}
              </Text>
            ) : null}
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${growth.ratio * 100}%` }]} />
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
            label={t('childHome.morningShort')}
            onPress={() =>
              router.push({ pathname: '/brushing', params: { slot: 'morning' } } as Href)
            }
            onReminderPress={() =>
              router.push({ pathname: '/parent-gate', params: { next: 'reminders' } } as Href)
            }
            reminderLabel={t('childHome.openReminders')}
            status={t(progress.morningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="morning-task"
            tone="morning"
          />
          <TaskCard
            completed={progress.eveningCompleted}
            icon="🌙"
            label={t('childHome.eveningShort')}
            onPress={() =>
              router.push({ pathname: '/brushing', params: { slot: 'evening' } } as Href)
            }
            onReminderPress={() =>
              router.push({ pathname: '/parent-gate', params: { next: 'reminders' } } as Href)
            }
            reminderLabel={t('childHome.openReminders')}
            status={t(progress.eveningCompleted ? 'childHome.completed' : 'childHome.waiting')}
            testID="evening-task"
            tone="evening"
          />
        </View>
        {!isYoungerExperience ? (
          <Text style={styles.streak}>
            {t('childHome.streak', { count: progress.currentStreak })}
          </Text>
        ) : null}
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
  selectedRoomDecor: {
    bottom: 38,
    fontSize: 48,
    left: 18,
    lineHeight: 66,
    position: 'absolute',
    zIndex: 1,
  },
  selectedCloudCushion: {
    bottom: 4,
    fontSize: 76,
    left: '34%',
    lineHeight: 94,
    transform: [{ scaleX: 1.4 }],
  },
  selectedRoomEffect: { height: '100%', position: 'absolute', width: '100%', zIndex: 2 },
  effectOne: { fontSize: 25, left: 45, lineHeight: 34, position: 'absolute', top: 120 },
  effectTwo: { fontSize: 30, lineHeight: 40, position: 'absolute', right: 48, top: 82 },
  effectThree: { bottom: 92, fontSize: 22, lineHeight: 31, position: 'absolute', right: 70 },
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
  growthCard: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  growthCopy: { alignItems: 'flex-start', gap: 2 },
  brushingEstimate: { color: '#667078', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 66 },
  heroCharacter: { bottom: 24, position: 'absolute', zIndex: 3 },
  levelLabel: { color: colors.brandPrimary, fontSize: 20, fontWeight: '900' },
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
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  taskCardShell: { flex: 1, position: 'relative' },
  taskCardCompleted: { borderColor: colors.brandAccent, borderWidth: 3 },
  reminderBell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radii.pill,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 34,
    zIndex: 3,
  },
  reminderBellIcon: { fontSize: 15 },
  taskIcon: { fontSize: 25, lineHeight: 30 },
  taskRow: { alignSelf: 'center', flexDirection: 'row', gap: spacing.sm },
  taskTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
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
  xpFill: { backgroundColor: colors.brandAccent, borderRadius: radii.pill, height: '100%' },
  xpLabel: { color: colors.navy, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  xpTrack: {
    backgroundColor: '#E9E2F7',
    borderRadius: radii.pill,
    height: 12,
    overflow: 'hidden',
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
