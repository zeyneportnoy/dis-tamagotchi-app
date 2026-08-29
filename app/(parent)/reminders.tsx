import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Screen,
  ScreenHeader,
  Text,
  colors,
  radii,
  spacing,
  typography,
} from '@/design-system';
import { getFamilyUseCases } from '@/application/family';
import { syncAllChildPreferences } from '@/application/sync';
import { useAuth } from '@/features/auth';
import {
  defaultReminderSettings,
  reminderSettingsService,
  type BrushingReminderSettings,
  type ReminderSlot,
} from '@/features/reminders';

const minutesFromTime = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
};

const timeFromMinutes = (minutes: number): string => {
  const normalized = (minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

export default function BrushingRemindersScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [settings, setSettings] = useState<BrushingReminderSettings>(defaultReminderSettings);
  const [childProfileId, setChildProfileId] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReminderSlot | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testScheduled, setTestScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = session?.userId;
    if (!userId) return;
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then(async (activeProfile) => {
        if (!activeProfile) return;
        setChildProfileId(activeProfile.id);
        setSettings(await reminderSettingsService.get(userId, activeProfile.id));
      })
      .catch(() => undefined);
  }, [session?.userId]);

  const update = async (
    slot: ReminderSlot,
    change: Readonly<{ enabled?: boolean; time?: string }>,
  ): Promise<void> => {
    if (!session?.userId || !childProfileId || busy) return;
    setBusy(slot);
    setError(null);
    try {
      const result = await reminderSettingsService.update(
        session.userId,
        childProfileId,
        slot,
        change,
      );
      setSettings(result.settings);
      void syncAllChildPreferences();
      if (result.permissionDenied) setError(t('parent.reminders.permissionRequired'));
    } catch {
      setError(t('parent.reminders.updateError'));
    } finally {
      setBusy(null);
    }
  };

  const shiftTime = (slot: ReminderSlot, delta: number): void => {
    const time = timeFromMinutes(minutesFromTime(settings[slot].time) + delta);
    void update(slot, { enabled: settings[slot].enabled, time });
  };

  const scheduleTestNotification = async (): Promise<void> => {
    if (testBusy) return;
    setTestBusy(true);
    setTestScheduled(false);
    setError(null);
    try {
      const result = await reminderSettingsService.scheduleDevelopmentTest();
      if (result.permissionDenied) setError(t('parent.reminders.permissionRequired'));
      else setTestScheduled(true);
    } catch {
      setError(t('parent.reminders.testNotificationError'));
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <Screen style={styles.screen} testID="brushing-reminders-screen">
      <ScreenHeader
        backTestID="reminders-back-button"
        fallbackHref="/(parent)/settings"
        onBackPress={() => router.replace('/(parent)/settings')}
        title={t('parent.reminders.title')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {(['morning', 'evening'] as const).map((slot) => (
          <View
            key={slot}
            style={[styles.card, slot === 'morning' ? styles.morningCard : styles.eveningCard]}
            testID={`${slot}-reminder-card`}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconBubble}>
                <Text style={styles.icon}>{slot === 'morning' ? '☀️' : '🌙'}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{t(`parent.reminders.${slot}`)}</Text>
                <Text style={styles.secondary}>{t('parent.reminders.daily')}</Text>
              </View>
              <Switch
                accessibilityLabel={t(`parent.reminders.${slot}Toggle`)}
                disabled={busy !== null}
                onValueChange={(enabled) => void update(slot, { enabled })}
                testID={`${slot}-reminder-toggle`}
                trackColor={{ false: '#D9D3DA', true: colors.brandAccent }}
                value={settings[slot].enabled}
              />
            </View>
            <View style={styles.timePicker}>
              <Pressable
                accessibilityLabel={t('parent.reminders.earlier', {
                  slot: t(`parent.reminders.${slot}`),
                })}
                accessibilityRole="button"
                onPress={() => shiftTime(slot, -15)}
                style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
              >
                <Text style={styles.timeButtonLabel}>−</Text>
              </Pressable>
              <View style={styles.timeValue}>
                <Text style={styles.time}>{settings[slot].time}</Text>
              </View>
              <Pressable
                accessibilityLabel={t('parent.reminders.later', {
                  slot: t(`parent.reminders.${slot}`),
                })}
                accessibilityRole="button"
                onPress={() => shiftTime(slot, 15)}
                style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
              >
                <Text style={styles.timeButtonLabel}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {__DEV__ ? (
          <View style={styles.testArea} testID="development-test-notification-area">
            <Button
              disabled={testBusy}
              label={
                testBusy
                  ? t('parent.reminders.testNotificationScheduling')
                  : t('parent.reminders.testNotification')
              }
              onPress={() => void scheduleTestNotification()}
              testID="schedule-test-notification-button"
              variant="secondary"
            />
            {testScheduled ? (
              <Text style={styles.testSuccess}>
                {t('parent.reminders.testNotificationScheduled')}
              </Text>
            ) : null}
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  cardTitle: { fontSize: 18, fontWeight: '900', lineHeight: 24 },
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  copy: { flex: 1, gap: 2 },
  eveningCard: { borderColor: '#DDD0FF', borderWidth: 1 },
  error: { color: colors.danger, fontWeight: '800' },
  icon: { fontSize: 23, lineHeight: 29 },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: '#FFF5D8',
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  morningCard: { borderColor: '#FFE2A3', borderWidth: 1 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  screen: { gap: spacing.lg, justifyContent: 'flex-start' },
  secondary: { color: colors.navy, fontSize: 15, lineHeight: 20, opacity: 0.62 },
  testArea: { gap: spacing.sm },
  testSuccess: { color: colors.success, fontWeight: '800', textAlign: 'center' },
  time: {
    color: colors.brandPrimary,
    fontFamily: typography.family.display,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 42,
  },
  timeButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9FF',
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  timeButtonLabel: {
    color: colors.brandPrimary,
    fontFamily: typography.family.display,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  timePicker: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  timeValue: { alignItems: 'center', minWidth: 116 },
});
