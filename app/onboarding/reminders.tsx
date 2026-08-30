import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

const minutesFromTime = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
};

const timeFromMinutes = (minutes: number): string => {
  const normalized = (minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

export default function OnboardingRemindersScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const [choice, setChoice] = useState<'enable' | 'skip' | null>(null);
  const [times, setTimes] = useState({
    morning: draft.morningReminderTime || defaultReminderSettings.morning.time,
    evening: draft.eveningReminderTime || defaultReminderSettings.evening.time,
  });

  const shiftTime = (slot: ReminderSlot, delta: number): void => {
    setTimes((current) => ({
      ...current,
      [slot]: timeFromMinutes(minutesFromTime(current[slot]) + delta),
    }));
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
                    accessibilityLabel={t('parent.reminders.earlier', {
                      slot: t(`parent.reminders.${slot}`),
                    })}
                    accessibilityRole="button"
                    onPress={() => shiftTime(slot, -15)}
                    style={styles.timeButton}
                  >
                    <Text style={styles.timeButtonLabel}>−</Text>
                  </Pressable>
                  <Text style={styles.time}>{times[slot]}</Text>
                  <Pressable
                    accessibilityLabel={t('parent.reminders.later', {
                      slot: t(`parent.reminders.${slot}`),
                    })}
                    accessibilityRole="button"
                    onPress={() => shiftTime(slot, 15)}
                    style={styles.timeButton}
                  >
                    <Text style={styles.timeButtonLabel}>+</Text>
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
    lineHeight: 34,
  },
  timeCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  timePicker: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  timeTitle: { fontSize: 18, fontWeight: '900' },
  times: { gap: spacing.md },
});
