import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
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
  syncGroupedBrushingReminders,
  type BrushingReminderSettings,
  type ReminderSlot,
} from '@/features/reminders';

const dateFromTime = (time: string): Date => {
  const [hours = '0', minutes = '0'] = time.split(':');
  const value = new Date();
  value.setHours(Number(hours), Number(minutes), 0, 0);
  return value;
};

const timeFromDate = (value: Date): string =>
  `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

export default function BrushingRemindersScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [settings, setSettings] = useState<BrushingReminderSettings>(defaultReminderSettings);
  const [childProfileId, setChildProfileId] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReminderSlot | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testScheduled, setTestScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<ReminderSlot | null>(null);
  const [pendingTime, setPendingTime] = useState(() =>
    dateFromTime(defaultReminderSettings.morning.time),
  );

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
    const parentUserId = session.userId;
    setBusy(slot);
    setError(null);
    try {
      const result = await reminderSettingsService.update(
        parentUserId,
        childProfileId,
        slot,
        change,
      );
      setSettings(result.settings);
      void syncAllChildPreferences();
      // Rebuild the device's grouped brushing schedule: children sharing a time
      // collapse into one notification, others stay separate — each child's
      // stored settings above are untouched.
      const profiles = await getFamilyUseCases().then((useCases) => useCases.listProfiles());
      await syncGroupedBrushingReminders(
        parentUserId,
        profiles.map((profile) => ({ id: profile.id, nickname: profile.nickname })),
      );
      if (result.permissionDenied) setError(t('parent.reminders.permissionRequired'));
    } catch {
      setError(t('parent.reminders.updateError'));
    } finally {
      setBusy(null);
    }
  };

  const openTimePicker = (slot: ReminderSlot): void => {
    setPendingTime(dateFromTime(settings[slot].time));
    setEditingSlot(slot);
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedTime?: Date): void => {
    if (event.type === 'dismissed') {
      setEditingSlot(null);
      return;
    }
    if (selectedTime) setPendingTime(selectedTime);
  };

  const confirmTime = (): void => {
    const slot = editingSlot;
    if (!slot) return;
    const time = timeFromDate(pendingTime);
    setEditingSlot(null);
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
                accessibilityLabel={t('parent.reminders.chooseTime', {
                  slot: t(`parent.reminders.${slot}`),
                  time: settings[slot].time,
                })}
                accessibilityRole="button"
                disabled={busy !== null}
                onPress={() => openTimePicker(slot)}
                style={({ pressed }) => [styles.timeValue, pressed && styles.pressed]}
                testID={`${slot}-reminder-time-picker`}
              >
                <Text style={styles.time}>{settings[slot].time}</Text>
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
      <Modal
        animationType="fade"
        onRequestClose={() => setEditingSlot(null)}
        transparent
        visible={editingSlot !== null}
      >
        <View style={styles.pickerBackdrop}>
          <View accessibilityViewIsModal style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>
              {editingSlot ? t(`parent.reminders.${editingSlot}`) : ''}
            </Text>
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              is24Hour
              locale="tr-TR"
              minuteInterval={1}
              mode="time"
              onChange={handleTimeChange}
              testID="brushing-reminder-native-time-picker"
              value={pendingTime}
            />
            <View style={styles.pickerActions}>
              <View style={styles.pickerAction}>
                <Button
                  label={t('common.cancel')}
                  onPress={() => setEditingSlot(null)}
                  variant="secondary"
                />
              </View>
              <View style={styles.pickerAction}>
                <Button label={t('common.done')} onPress={confirmTime} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  timePicker: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  timeValue: {
    alignItems: 'center',
    backgroundColor: '#F0E9FF',
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 150,
    paddingHorizontal: spacing.lg,
  },
  pickerAction: { flex: 1 },
  pickerActions: { flexDirection: 'row', gap: spacing.sm },
  pickerBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(38,50,56,0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    maxWidth: 430,
    padding: spacing.md,
    width: '100%',
  },
  pickerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900' },
});
