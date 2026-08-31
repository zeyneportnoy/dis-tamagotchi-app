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

const SLOTS: readonly ReminderSlot[] = ['morning', 'evening'];
const rebuildQueues = new Map<string, Promise<void>>();

const possessiveVowelForName = (name: string): 'ı' | 'i' | 'u' | 'ü' => {
  const vowels = [...name.toLocaleLowerCase('tr-TR')].filter((character) =>
    'aeıioöuü'.includes(character),
  );
  const lastVowel = vowels.at(-1);
  if (lastVowel === 'a' || lastVowel === 'ı') return 'ı';
  if (lastVowel === 'o' || lastVowel === 'u') return 'u';
  if (lastVowel === 'ö' || lastVowel === 'ü') return 'ü';
  return 'i';
};

const possessiveName = (name: string): string => {
  const possessiveVowel = possessiveVowelForName(name);
  const endsWithVowel = 'aeıioöuü'.includes(name.at(-1)?.toLocaleLowerCase('tr-TR') ?? '');
  return `${name}’${endsWithVowel ? 'n' : ''}${possessiveVowel}n`;
};

/**
 * Turkish possessive subject for a grouped brushing notification title:
 *  - 1 name  → "Emrah’ın"
 *  - 2 names → "Emrah ve Nazlı’nın"
 *  - 3 names → "Emrah, Nazlı ve Zeynep’in"
 */
export function groupedBrushingSubject(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter((name) => name.length > 0);
  if (clean.length === 0) return 'Çocukların';
  const last = clean[clean.length - 1];
  const head = clean.slice(0, -1);
  return head.length === 0
    ? possessiveName(last)
    : `${head.join(', ')} ve ${possessiveName(last)}`;
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

const isBrushingReminderRequest = (
  request: Notifications.NotificationRequest,
): boolean => {
  const slot = request.content.data?.reminderSlot;
  return slot === 'morning' || slot === 'evening';
};

/**
 * Cancels brushing schedules by their notification metadata, not only by IDs
 * still present in AsyncStorage. This catches orphaned legacy/per-child/grouped
 * schedules left by deleted profiles, older implementations or interrupted
 * settings writes while preserving dentist, birthday and test notifications.
 */
async function cancelAllScheduledBrushingReminders(): Promise<void> {
  const requests = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const request of requests) {
    if (!isBrushingReminderRequest(request)) continue;
    await Notifications.cancelScheduledNotificationAsync(request.identifier).catch(
      () => undefined,
    );
  }
}

/**
 * Device-level reconciliation of brushing reminders across *all* of a parent's
 * children. Each child keeps its own separate reminder settings (still owned by
 * `reminderSettingsService`); this only decides what the OS actually delivers:
 * exactly one notification per unique effective time, with every child sharing
 * that time represented in the title — never one notification per child at the
 * same time. Children with different times still get separate notifications,
 * each with only their own name.
 *
 * Fully cancels and rebuilds the grouped schedule, so it is idempotent and safe
 * to call after any change to a child's reminder settings or to the roster
 * (add / rename / remove).
 */
async function rebuildGroupedBrushingReminders(
  parentId: string,
  children: readonly BrushingReminderChild[],
): Promise<void> {
  // 1. Drop the previous grouped notifications.
  for (const id of await readStoredGroupIds(parentId)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }

  // IDs can be lost when a profile is removed, an old app version scheduled
  // per-child notifications, or a write was interrupted. Sweep only requests
  // carrying brushing-reminder metadata; dentist/birthday schedules are left
  // completely untouched.
  await cancelAllScheduledBrushingReminders();

  // 2. Drop any lingering per-child notifications scheduled by
  //    reminderSettingsService and clear their stale device-local IDs — the
  //    grouped ones supersede them while enabled/time preferences stay intact.
  const settingsByChild = new Map<string, BrushingReminderSettings>();
  for (const child of children) {
    try {
      const settings = await reminderSettingsService.clearScheduledNotificationIds(
        parentId,
        child.id,
      );
      settingsByChild.set(child.id, settings);
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

  // 4. Bucket enabled reminders by the actual effective HH:mm, preserving child
  //    order. Morning/evening preferences stay separate in storage, but two
  //    enabled preferences resolving to the same delivery time produce one OS
  //    notification, never two.
  const buckets = new Map<
    string,
    { childIds: Set<string>; slot: ReminderSlot; time: string; names: string[] }
  >();
  for (const child of children) {
    const settings = settingsByChild.get(child.id);
    if (!settings) continue;
    for (const slot of SLOTS) {
      if (!settings[slot].enabled) continue;
      const { time } = settings[slot];
      const bucket = buckets.get(time) ?? {
        childIds: new Set<string>(),
        slot,
        time,
        names: [],
      };
      if (!bucket.childIds.has(child.id)) {
        bucket.childIds.add(child.id);
        bucket.names.push(child.nickname);
      }
      buckets.set(time, bucket);
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

/**
 * Serializes rebuilds per parent. Settings/profile mutations can request a
 * rebuild concurrently; without this queue both calls could cancel the same old
 * IDs and then each create a replacement grouped notification.
 */
export async function syncGroupedBrushingReminders(
  parentId: string,
  children: readonly BrushingReminderChild[],
): Promise<void> {
  if (!parentId) return;
  const previous = rebuildQueues.get(parentId) ?? Promise.resolve();
  const pending = previous
    .catch(() => undefined)
    .then(() => rebuildGroupedBrushingReminders(parentId, children));
  rebuildQueues.set(parentId, pending);
  try {
    await pending;
  } finally {
    if (rebuildQueues.get(parentId) === pending) rebuildQueues.delete(parentId);
  }
}
