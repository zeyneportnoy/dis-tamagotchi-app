import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { parseDateOnly } from '@/domain/family';
import i18n from '@/i18n';

/** The child data a birthday notification is built from. */
export type BirthdayReminderProfile = Readonly<{
  id: string;
  nickname: string;
  dateOfBirth: string | null;
}>;

const BIRTHDAY_HOUR = 9;

/** Stable per-child identifier so re-scheduling replaces the previous one. */
const identifierFor = (childProfileId: string): string => `birthday-${childProfileId}`;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('birthday-reminders', {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: i18n.t('parent.birthday.channelName'),
  });
}

class BirthdayReminderService {
  /**
   * Ensures a single yearly 09:00 local birthday notification for the child,
   * built from their saved birth date and current nickname. Re-scheduling under
   * the same stable identifier replaces any previous one, so this is also the
   * "birth date changed" / "name changed" update path. Only the month and day of
   * the birth date are read — the child's age is never computed or shown.
   * Per child; never grouped with any other child.
   */
  async scheduleForProfile(profile: BirthdayReminderProfile): Promise<void> {
    await this.cancelForProfile(profile.id);

    if (!profile.dateOfBirth) return;
    const parts = parseDateOnly(profile.dateOfBirth);
    if (!parts) return;

    try {
      if ((await Notifications.getPermissionsAsync()).granted !== true) return;
    } catch {
      return;
    }

    await ensureAndroidChannel();
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: identifierFor(profile.id),
        content: {
          body: i18n.t('parent.birthday.body'),
          data: { birthdayChildProfileId: profile.id },
          sound: 'default',
          title: i18n.t('parent.birthday.title', { childName: profile.nickname }),
        },
        trigger: {
          channelId: Platform.OS === 'android' ? 'birthday-reminders' : undefined,
          day: parts.day,
          hour: BIRTHDAY_HOUR,
          minute: 0,
          month: parts.month - 1, // expo-notifications YEARLY month is 0-indexed
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        },
      });
    } catch {
      // best effort — the saved birth date is unaffected if scheduling fails
    }
  }

  async cancelForProfile(childProfileId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifierFor(childProfileId)).catch(
      () => undefined,
    );
  }
}

export const birthdayReminderService = new BirthdayReminderService();
