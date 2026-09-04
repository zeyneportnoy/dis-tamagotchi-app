import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Screen,
  SelectionCard,
  Text,
  colors,
  radii,
  spacing,
  typography,
} from '@/design-system';
import { defaultReminderSettings, type ReminderSlot } from '@/features/reminders';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

// Mirrors the exact-minute picker in Parent Settings (app/(parent)/reminders.tsx)
// so onboarding and settings stay consistent in minute precision.
const dateFromTime = (time: string): Date => {
  const [hours = '0', minutes = '0'] = time.split(':');
  const value = new Date();
  value.setHours(Number(hours), Number(minutes), 0, 0);
  return value;
};

const timeFromDate = (value: Date): string =>
  `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

export default function OnboardingRemindersScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const [choice, setChoice] = useState<'enable' | 'skip' | null>(null);
  const [times, setTimes] = useState({
    morning: draft.morningReminderTime || defaultReminderSettings.morning.time,
    evening: draft.eveningReminderTime || defaultReminderSettings.evening.time,
  });
  const [editingSlot, setEditingSlot] = useState<ReminderSlot | null>(null);
  const [pendingTime, setPendingTime] = useState<Date>(() =>
    dateFromTime(draft.morningReminderTime || defaultReminderSettings.morning.time),
  );

  const openTimePicker = (slot: ReminderSlot): void => {
    setPendingTime(dateFromTime(times[slot]));
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
    const value = timeFromDate(pendingTime);
    setEditingSlot(null);
    setTimes((current) => ({ ...current, [slot]: value }));
  };

  // The child profile is created on the summary screen; store the choice on the
  // onboarding draft and apply it per-child there.
  const saveAndContinue = (): void => {
    draft.setReminderChoice({
      enabled: true,
      morningTime: times.morning,
      eveningTime: times.evening,
    });
    router.push('/onboarding/dentist-visit');
  };

  return (
    <Screen style={styles.screen} testID="onboarding-reminders-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.copy}>
          <Text style={styles.center} variant="title">
            {t('onboarding.reminders.title')}
          </Text>
          <Text style={styles.center}>{t('onboarding.reminders.body')}</Text>
        </View>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          <SelectionCard
            label={t('onboarding.reminders.enable')}
            onPress={() => setChoice('enable')}
            selected={choice === 'enable'}
            testID="enable-onboarding-reminders"
          />
          <SelectionCard
            label={t('onboarding.reminders.skip')}
            onPress={() => {
              setChoice('skip');
              draft.setReminderChoice({ enabled: false });
              router.push('/onboarding/dentist-visit');
            }}
            selected={choice === 'skip'}
            testID="skip-onboarding-reminders"
          />
        </View>
        {choice === 'enable' ? (
          <View style={styles.times}>
            {(['morning', 'evening'] as const).map((slot) => (
              <View key={slot} style={styles.timeCard} testID={`${slot}-onboarding-time`}>
                <Text style={styles.timeTitle}>{t(`parent.reminders.${slot}`)}</Text>
                <View style={styles.timePicker}>
                  <Pressable
                    accessibilityLabel={t('parent.reminders.chooseTime', {
                      slot: t(`parent.reminders.${slot}`),
                      time: times[slot],
                    })}
                    accessibilityRole="button"
                    onPress={() => openTimePicker(slot)}
                    style={({ pressed }) => [styles.timeValue, pressed && styles.pressed]}
                    testID={`${slot}-onboarding-time-picker`}
                  >
                    <Text style={styles.time}>{times[slot]}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Button
              label={t('onboarding.reminders.save')}
              onPress={saveAndContinue}
              testID="save-onboarding-reminders"
            />
          </View>
        ) : null}
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
              testID="onboarding-reminder-native-time-picker"
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
  center: { textAlign: 'center' },
  choices: { gap: spacing.sm },
  content: { flexGrow: 1, gap: spacing.lg, justifyContent: 'center', paddingBottom: spacing.lg },
  copy: { gap: spacing.sm },
  screen: { justifyContent: 'flex-start' },
  time: {
    color: colors.brandPrimary,
    fontFamily: typography.family.display,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
  },
  timeCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  timePicker: { alignItems: 'center' },
  timeTitle: { fontSize: 18, fontWeight: '900' },
  timeValue: {
    alignItems: 'center',
    backgroundColor: '#F0E9FF',
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 150,
    paddingHorizontal: spacing.lg,
  },
  times: { gap: spacing.md },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
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
