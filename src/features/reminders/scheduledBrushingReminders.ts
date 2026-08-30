import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

import {
  reminderSettingsService,
  type BrushingReminderSettings,
  type ReminderSlot,
} from './reminderSettings';

/** A child whose brushing reminders take part in this device's grouped schedule. */
export type BrushingReminderChild = Readonly<{ id: string; nickname: string }>;

const groupStorageKey = (parentId: string): string =>
  `parent:${parentId}:brushing-reminder-groups:v1`;

/** Beyond this many children at one time, drop names for a generic subject. */
const MAX_NAMES_IN_TITLE = 3;

const SLOTS: readonly ReminderSlot[] = ['morning', 'evening'];

/**
 * Turkish possessive subject for a grouped brushing notification title:
 *  - 1 name  → "Defne’nin"
 *  - 2 names → "Defne ve Ece’nin"
 *  - 3 names → "Defne, Ece ve Ali’nin"
 *  - 0 or >3 → "Çocukların"
 */
export function groupedBrushingSubject(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter((name) => name.length > 0);
  if (clean.length === 0 || clean.length > MAX_NAMES_IN_TITLE) return 'Çocukların';
  const last = clean[clean.length - 1];
  const head = clean.slice(0, -1);
  const joined = head.length === 0 ? last : `${head.join(', ')} ve ${last}`;
  return `${joined}’nin`;
}

async function readStoredGroupIds(parentId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(groupStorageKey(parentId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('brushing-reminders', {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: i18n.t('parent.reminders.channelName'),
  });
}

/**
 * Device-level reconciliation of brushing reminders across *all* of a parent's
 * children. Each child keeps its own separate reminder settings (still owned by
 * `reminderSettingsService`); this only decides what the OS actually delivers:
 * exactly one notification per unique (slot, time), with every child sharing
 * that time named in the title — never one notification per child at the same
 * time. Children with different times still get separate notifications, each
 * with only their own name.
 *
 * Fully cancels and rebuilds the grouped schedule, so it is idempotent and safe
 * to call after any change to a child's reminder settings or to the roster
 * (add / rename / remove).
 */
export async function syncGroupedBrushingReminders(
  parentId: string,
  children: readonly BrushingReminderChild[],
): Promise<void> {
  if (!parentId) return;

  // 1. Drop the previous grouped notifications.
  for (const id of await readStoredGroupIds(parentId)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }

  // 2. Drop any lingering per-child notifications scheduled by
  //    reminderSettingsService — the grouped ones supersede them.
  const settingsByChild = new Map<string, BrushingReminderSettings>();
  for (const child of children) {
    try {
      const settings = await reminderSettingsService.get(parentId, child.id);
      settingsByChild.set(child.id, settings);
      for (const slot of SLOTS) {
        const perChildId = settings[slot].notificationId;
        if (perChildId) {
          await Notifications.cancelScheduledNotificationAsync(perChildId).catch(() => undefined);
        }
      }
    } catch {
      // an unreadable child simply won't be grouped
    }
  }

  // 3. Only (re)schedule when notifications are actually permitted.
  let granted = false;
  try {
    granted = (await Notifications.getPermissionsAsync()).granted === true;
  } catch {
    granted = false;
  }
  if (!granted) {
    await AsyncStorage.setItem(groupStorageKey(parentId), '[]').catch(() => undefined);
    return;
  }

  // 4. Bucket enabled reminders by (slot, HH:mm), preserving child order.
  const buckets = new Map<string, { slot: ReminderSlot; time: string; names: string[] }>();
  for (const child of children) {
    const settings = settingsByChild.get(child.id);
    if (!settings) continue;
    for (const slot of SLOTS) {
      if (!settings[slot].enabled) continue;
      const { time } = settings[slot];
      const key = `${slot}@${time}`;
      const bucket = buckets.get(key) ?? { slot, time, names: [] };
      bucket.names.push(child.nickname);
      buckets.set(key, bucket);
    }
  }

  // 5. Schedule exactly one notification per bucket.
  await ensureAndroidChannel();
  const scheduledIds: string[] = [];
  for (const { slot, time, names } of buckets.values()) {
    const [hour = '0', minute = '0'] = time.split(':');
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          body: i18n.t(`parent.reminders.messages.${slot}.0`),
          data: { grouped: true, reminderSlot: slot },
          sound: 'default',
          title: i18n.t('parent.reminders.notificationTitleGrouped', {
            names: groupedBrushingSubject(names),
          }),
        },
        trigger: {
          channelId: Platform.OS === 'android' ? 'brushing-reminders' : undefined,
          hour: Number(hour),
          minute: Number(minute),
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
        },
      });
      scheduledIds.push(id);
    } catch {
      // best effort — keep scheduling the remaining buckets
    }
  }

  await AsyncStorage.setItem(groupStorageKey(parentId), JSON.stringify(scheduledIds)).catch(
    () => undefined,
  );
}
