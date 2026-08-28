import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function OnboardingRemindersScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [choice, setChoice] = useState<'enable' | 'skip' | null>(null);
  const [settings, setSettings] = useState<BrushingReminderSettings>(defaultReminderSettings);
  const [loaded, setLoaded] = useState(!session?.userId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session?.userId) return;
    void reminderSettingsService
      .get(session.userId)
      .then(setSettings)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [session?.userId]);

  const shiftTime = (slot: ReminderSlot, delta: number): void => {
    setSettings((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        time: timeFromMinutes(minutesFromTime(current[slot].time) + delta),
      },
    }));
  };

  const saveAndContinue = async (): Promise<void> => {
    if (!session?.userId || saving) return;
    setSaving(true);
    setError(false);
    try {
      await reminderSettingsService.update(session.userId, 'morning', {
        enabled: true,
        time: settings.morning.time,
      });
      await reminderSettingsService.update(session.userId, 'evening', {
        enabled: true,
        time: settings.evening.time,
      });
      router.push('/onboarding/summary');
    } catch {
      setError(true);
      setSaving(false);
    }
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
        {loaded ? (
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
                router.push('/onboarding/summary');
              }}
              selected={choice === 'skip'}
              testID="skip-onboarding-reminders"
            />
          </View>
        ) : (
          <Text style={styles.center}>{t('common.loading')}</Text>
        )}
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
                  <Text style={styles.time}>{settings[slot].time}</Text>
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
            {error ? <Text style={styles.error}>{t('onboarding.reminders.error')}</Text> : null}
            <Button
              disabled={saving}
              label={saving ? t('common.saving') : t('onboarding.reminders.save')}
              onPress={() => void saveAndContinue()}
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
  error: { color: colors.danger, fontWeight: '800' },
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
