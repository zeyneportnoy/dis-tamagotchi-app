import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getChildExperienceUseCases, subscribeToChildProgressChanges } from '@/application/child';
import { getFamilyUseCases } from '@/application/family';
import { ErrorState, LoadingState, Screen, Text, colors, radii, spacing } from '@/design-system';
import { toLocalDateKey } from '@/domain/brushing';
import { deriveHomeCharacterMood } from '@/domain/character';
import type { BrushingSession, ProfileProgress, StarterAvatarKey } from '@/domain/family';
import { growthProgressForXp } from '@/domain/rewards';
import { CharacterAvatar, sceneBackgroundForCharacter } from '@/features/character';

type DayStatus = 'before-join' | 'full' | 'future' | 'missed' | 'partial' | 'pending';
type DailyEntry = { evening: string | null; morning: string | null };
type DailyMap = Record<string, DailyEntry>;

function buildDailyMap(sessions: readonly BrushingSession[]): DailyMap {
  const map: DailyMap = {};
  for (const session of sessions) {
    if (!session.period) continue;
    const dayKey = session.localDayKey ?? toLocalDateKey(new Date(session.completedAt));
    const entry = map[dayKey] ?? { evening: null, morning: null };
    map[dayKey] = { ...entry, [session.period]: session.completedAt };
  }
  return map;
}

function statusForDay(
  dayKey: string,
  todayKey: string,
  daily: DailyMap,
  joinedDayKey: string | null,
): DayStatus {
  if (dayKey > todayKey) return 'future';
  // Days before the profile existed are shown neutral, never as a missed brushing.
  if (joinedDayKey && dayKey < joinedDayKey) return 'before-join';
  const entry = daily[dayKey];
  const morningDone = Boolean(entry?.morning);
  const eveningDone = Boolean(entry?.evening);
  if (morningDone && eveningDone) return 'full';
  if (morningDone || eveningDone) return 'partial';
  return dayKey === todayKey ? 'pending' : 'missed';
}

function iconForStatus(status: DayStatus): string {
  switch (status) {
    case 'full':
      return '✨';
    case 'partial':
      return '🌗';
    case 'missed':
      return '😢';
    case 'pending':
      return '⏳';
    default:
      return '';
  }
}

function buildMonthGrid(monthCursor: Date): readonly (Date | null)[] {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let index = 0; index < startOffset; index += 1) grid.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) grid.push(new Date(year, month, day));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export type SlotDisplayStatus = 'done' | 'missed' | 'waiting';

/**
 * Derives a slot's display status from the real slot hours (morning 04:00–11:59,
 * evening 18:00–23:59) plus the current time and completion state. It never
 * changes reward/penalty logic — it only decides which label to show.
 */
export function slotDisplayStatus(
  period: 'evening' | 'morning',
  input: Readonly<{ done: boolean; statusDate?: string | null }>,
  now: Date,
): SlotDisplayStatus {
  if (input.done) return 'done';
  const todayKey = toLocalDateKey(now);
  // The day this status belongs to is already over → the slot was missed.
  if (input.statusDate && input.statusDate < todayKey) return 'missed';
  // Morning slot closes at 12:00; after that an unfinished morning is missed.
  if (period === 'morning') return now.getHours() >= 12 ? 'missed' : 'waiting';
  // Evening slot runs until the day ends, so within its own day it is still coming.
  return 'waiting';
}

const weekdayLabels = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

export default function TasksScreen() {
  const { t } = useTranslation();
  const [characterKey, setCharacterKey] = useState<StarterAvatarKey>('inci');
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [sessions, setSessions] = useState<readonly BrushingSession[]>([]);
  const [failed, setFailed] = useState(false);
  const [joinedDayKey, setJoinedDayKey] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState(() => toLocalDateKey(new Date()));

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getFamilyUseCases()
        .then(async (family) => {
          const active = await family.getActiveProfile();
          if (!active || !mounted) return;
          setCharacterKey(active.avatarId);
          const joinedAt = new Date(active.createdAt);
          if (!Number.isNaN(joinedAt.getTime())) setJoinedDayKey(toLocalDateKey(joinedAt));
          const childUseCases = await getChildExperienceUseCases();
          const [nextProgress, completedSessions] = await Promise.all([
            childUseCases.getProgress(active.id),
            childUseCases.listCompletedSessions(active.id),
          ]);
          if (!mounted) return;
          setProgress(nextProgress);
          setSessions(completedSessions);
        })
        .catch(() => mounted && setFailed(true));
      return () => {
        mounted = false;
      };
    }, []),
  );

  useEffect(
    () =>
      subscribeToChildProgressChanges((nextProgress) => {
        setProgress((current) =>
          current?.childProfileId === nextProgress.childProfileId ? nextProgress : current,
        );
      }),
    [],
  );

  const dailyMap = useMemo(() => buildDailyMap(sessions), [sessions]);
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const monthGrid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const selectedEntry = dailyMap[selectedDayKey];
  const selectedStatus = statusForDay(selectedDayKey, todayKey, dailyMap, joinedDayKey);

  if (failed) return <ErrorState />;
  if (!progress) return <LoadingState />;

  const now = new Date();
  const growthStage = growthProgressForXp(progress.totalXp).currentStage;
  const mood = deriveHomeCharacterMood(progress);
  const todayLabel = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
  const selectedDate = new Date(`${selectedDayKey}T00:00:00`);
  const selectedLabel = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(selectedDate);
  const monthLabel = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(
    monthCursor,
  );

  function slotLine(period: 'evening' | 'morning'): string {
    const time = period === 'morning' ? selectedEntry?.morning : selectedEntry?.evening;
    if (time) return t('tasksScreen.doneAt', { time: formatTime(time) });
    if (selectedStatus === 'before-join') return t('tasksScreen.beforeJoin');
    if (selectedDayKey > todayKey) return t('tasksScreen.futureDay');
    if (selectedDayKey === todayKey) {
      return slotDisplayStatus(period, { done: false }, now) === 'missed'
        ? t('tasksScreen.slotMissed')
        : t('tasksScreen.notDoneYet');
    }
    return t('tasksScreen.missed');
  }

  return (
    <Screen
      style={[styles.screen, { backgroundColor: sceneBackgroundForCharacter(characterKey) }]}
      testID="tasks-screen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <CharacterAvatar
            characterKey={characterKey}
            growthStage={growthStage}
            mood={mood}
            size="tiny"
          />
          <View style={styles.headerText}>
            <Text style={styles.heading} variant="subtitle">
              {t('placeholders.tasksTitle')}
            </Text>
            <Text style={styles.todayDate}>{todayLabel}</Text>
          </View>
        </View>

        <View style={styles.todayCard}>
          <Pressable
            accessibilityLabel={t('childHome.morningShort')}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/brushing', params: { slot: 'morning' } } as Href)
            }
            style={styles.todayRow}
            testID="tasks-morning-row"
          >
            <Text style={styles.todayIcon}>☀️</Text>
            <Text style={styles.todayCopy}>{slotLineForToday(progress, 'morning', now, t)}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t('childHome.eveningShort')}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/brushing', params: { slot: 'evening' } } as Href)
            }
            style={styles.todayRow}
            testID="tasks-evening-row"
          >
            <Text style={styles.todayIcon}>🌙</Text>
            <Text style={styles.todayCopy}>{slotLineForToday(progress, 'evening', now, t)}</Text>
          </Pressable>
          <Text style={styles.streak}>
            {t('childHome.streak', { count: progress.currentStreak })}
          </Text>
        </View>

        <View style={styles.calendarCard} testID="tasks-calendar">
          <View style={styles.calendarHeader}>
            <Pressable
              accessibilityLabel={t('tasksScreen.previousMonth')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() =>
                setMonthCursor(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              <Text style={styles.calendarNav}>‹</Text>
            </Pressable>
            <Text style={styles.calendarTitle}>{monthLabel}</Text>
            <Pressable
              accessibilityLabel={t('tasksScreen.nextMonth')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() =>
                setMonthCursor(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              <Text style={styles.calendarNav}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {monthGrid.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const dayKey = toLocalDateKey(date);
              const status = statusForDay(dayKey, todayKey, dailyMap, joinedDayKey);
              const isSelected = dayKey === selectedDayKey;
              return (
                <Pressable
                  key={dayKey}
                  accessibilityLabel={`${date.getDate()}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedDayKey(dayKey)}
                  style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                  testID={`tasks-day-${dayKey}`}
                >
                  <Text style={styles.dayNumber}>{date.getDate()}</Text>
                  <Text style={styles.dayIcon}>{iconForStatus(status)}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <Text style={styles.legendItem}>✨ {t('tasksScreen.legendFull')}</Text>
            <Text style={styles.legendItem}>🌗 {t('tasksScreen.legendPartial')}</Text>
            <Text style={styles.legendItem}>😢 {t('tasksScreen.legendMissed')}</Text>
          </View>
        </View>

        <View style={styles.detailCard} testID="tasks-day-detail">
          <Text style={styles.detailTitle}>{selectedLabel}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.todayIcon}>☀️</Text>
            <Text style={styles.detailCopy}>{slotLine('morning')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.todayIcon}>🌙</Text>
            <Text style={styles.detailCopy}>{slotLine('evening')}</Text>
          </View>
          {selectedStatus === 'missed' ? (
            <Text style={styles.encouragement}>{t('tasksScreen.encouragement')}</Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function slotLineForToday(
  progress: ProfileProgress,
  period: 'evening' | 'morning',
  now: Date,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const done = period === 'morning' ? progress.morningCompleted : progress.eveningCompleted;
  const status = slotDisplayStatus(period, { done, statusDate: progress.statusDate }, now);
  if (status === 'done') {
    return progress.lastBrushingAt
      ? t('tasksScreen.doneAt', { time: formatTime(progress.lastBrushingAt) })
      : t('childHome.completed');
  }
  if (status === 'missed') return t('tasksScreen.slotMissed');
  return t('childHome.waiting');
}

const styles = StyleSheet.create({
  calendarCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarNav: { fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.sm },
  calendarTitle: { fontSize: 15, fontWeight: '800' },
  content: { flexGrow: 1, gap: spacing.xs, paddingBottom: spacing.sm },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    width: `${100 / 7}%`,
  },
  dayCellSelected: { backgroundColor: colors.brandAccent, borderRadius: radii.md },
  dayIcon: { fontSize: 13, lineHeight: 16 },
  dayNumber: { fontSize: 13, fontWeight: '600' },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  detailCopy: { flex: 1, fontSize: 14 },
  detailRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  detailTitle: { fontSize: 15, fontWeight: '800', marginBottom: spacing.xs },
  encouragement: { fontSize: 13, marginTop: spacing.xs, opacity: 0.7 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heading: { textAlign: 'left' },
  headerText: { flex: 1, gap: 2 },
  legendItem: { fontSize: 11, opacity: 0.7 },
  legendRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  screen: { justifyContent: 'flex-start', paddingBottom: 0, paddingTop: spacing.sm },
  scroll: { flex: 1 },
  streak: {
    color: colors.textPrimary,
    fontSize: 13,
    marginTop: spacing.xs,
    opacity: 0.55,
    textAlign: 'center',
  },
  todayCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    padding: spacing.sm,
  },
  todayCopy: { flex: 1, fontSize: 14, fontWeight: '600' },
  todayDate: { fontSize: 13, opacity: 0.6 },
  todayIcon: { fontSize: 20, lineHeight: 24, width: 26 },
  todayRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textAlign: 'center',
    width: `${100 / 7}%`,
  },
  weekdayRow: { flexDirection: 'row' },
});
