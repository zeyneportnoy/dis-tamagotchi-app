import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

export type ReminderSlot = 'morning' | 'evening';
export type ReminderSlotSettings = Readonly<{
  enabled: boolean;
  notificationId: string | null;
  time: string;
}>;
export type BrushingReminderSettings = Readonly<Record<ReminderSlot, ReminderSlotSettings>>;

export const defaultReminderSettings: BrushingReminderSettings = {
  morning: { enabled: false, notificationId: null, time: '08:00' },
  evening: { enabled: false, notificationId: null, time: '20:30' },
};

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
type NotificationGateway = {
  cancel(id: string): Promise<void>;
  getPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  requestPermission(): Promise<'granted' | 'denied'>;
  schedule(slot: ReminderSlot, time: string, body: string): Promise<string>;
  scheduleTest(body: string): Promise<string>;
};

/** Pre-per-child key: still read as a seed value, never deleted. */
const legacyParentStorageKey = (parentId: string) => `parent:${parentId}:brushing-reminders:v1`;
const storageKey = (parentId: string, childProfileId: string) =>
  `parent:${parentId}:child:${childProfileId}:brushing-reminders:v1`;
const syncMetaKey = (parentId: string, childProfileId: string) =>
  `${storageKey(parentId, childProfileId)}.sync-meta`;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const sanitizeTime = (time: string, slot: ReminderSlot): string =>
  timePattern.test(time) ? time : defaultReminderSettings[slot].time;

export type ReminderSyncMeta = Readonly<{ syncedAt: string | null; dirty: boolean }>;

/** Preference fingerprint (enabled + time only — notificationId is device-local). */
const remindersFingerprint = (settings: BrushingReminderSettings): string =>
  JSON.stringify({
    morning: { enabled: settings.morning.enabled, time: settings.morning.time },
    evening: { enabled: settings.evening.enabled, time: settings.evening.time },
  });

function parseSettings(value: string | null): BrushingReminderSettings {
  if (!value) return defaultReminderSettings;
  try {
    const parsed = JSON.parse(value) as Partial<BrushingReminderSettings>;
    const slot = (key: ReminderSlot): ReminderSlotSettings => {
      const candidate = parsed[key];
      return {
        enabled: candidate?.enabled === true,
        notificationId:
          typeof candidate?.notificationId === 'string' ? candidate.notificationId : null,
        time: timePattern.test(candidate?.time ?? '')
          ? (candidate?.time ?? defaultReminderSettings[key].time)
          : defaultReminderSettings[key].time,
      };
    };
    return { evening: slot('evening'), morning: slot('morning') };
  } catch {
    return defaultReminderSettings;
  }
}

export class ReminderSettingsService {
  constructor(
    private readonly storage: Storage = AsyncStorage,
    private readonly notifications: NotificationGateway = expoNotificationGateway,
  ) {}

  /**
   * Reminder settings are now per child. When no child-specific record exists
   * yet it is seeded from the legacy parent-level record (kept intact) so an
   * existing family keeps its times.
   */
  async get(parentId: string, childProfileId: string): Promise<BrushingReminderSettings> {
    const child = await this.storage.getItem(storageKey(parentId, childProfileId));
    if (child !== null) return parseSettings(child);

    const legacy = await this.storage.getItem(legacyParentStorageKey(parentId));
    if (legacy === null) return defaultReminderSettings;
    const seeded = parseSettings(legacy);
    await this.storage.setItem(storageKey(parentId, childProfileId), JSON.stringify(seeded));
    return seeded;
  }

  /** True once a child-specific record has been stored (gates cloud recovery). */
  async hasStoredSettings(parentId: string, childProfileId: string): Promise<boolean> {
    return (await this.storage.getItem(storageKey(parentId, childProfileId))) !== null;
  }

  /** Records the preference fingerprint that was just pushed to the cloud. */
  async markSynced(parentId: string, childProfileId: string): Promise<void> {
    const fingerprint = remindersFingerprint(await this.get(parentId, childProfileId));
    await this.storage.setItem(
      syncMetaKey(parentId, childProfileId),
      JSON.stringify({ fingerprint, syncedAt: new Date().toISOString() }),
    );
  }

  /** Whether the local child reminder preference differs from the last push. */
  async readSyncMeta(parentId: string, childProfileId: string): Promise<ReminderSyncMeta> {
    // No stored child-specific (or legacy) record at all is NOT "dirty" —
    // nothing a user has actually set yet, so nothing warrants a push.
    if (!(await this.hasStoredSettings(parentId, childProfileId))) {
      return { syncedAt: null, dirty: false };
    }
    const stored = await this.storage.getItem(syncMetaKey(parentId, childProfileId));
    if (!stored) return { syncedAt: null, dirty: true };
    try {
      const parsed = JSON.parse(stored) as { fingerprint?: string; syncedAt?: string };
      const current = remindersFingerprint(await this.get(parentId, childProfileId));
      return {
        syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : null,
        dirty: parsed.fingerprint !== current,
      };
    } catch {
      return { syncedAt: null, dirty: true };
    }
  }

  /**
   * Cloud-recovery entry point: persist the recovered enabled/time values for a
   * child. Callers only invoke this for a child with no local record yet; a
   * local record is authoritative and is never replaced from the cloud. The
   * device-level grouped scheduler runs once after all children have recovered,
   * so this method must not create temporary per-child schedules.
   */
  async applyRecoveredPreferences(
    parentId: string,
    childProfileId: string,
    values: Readonly<Record<ReminderSlot, Readonly<{ enabled: boolean; time: string }>>>,
  ): Promise<void> {
    const key = storageKey(parentId, childProfileId);
    // Cancel any schedule from a previous record so a refresh never leaves a
    // duplicate notification behind.
    const existing = await this.storage.getItem(key);
    if (existing !== null) {
      const previous = parseSettings(existing);
      for (const slot of ['morning', 'evening'] as const) {
        if (previous[slot].notificationId) {
          await this.notifications.cancel(previous[slot].notificationId).catch(() => undefined);
        }
      }
    }

    const settings: Record<ReminderSlot, ReminderSlotSettings> = {
      morning: {
        enabled: values.morning.enabled,
        notificationId: null,
        time: sanitizeTime(values.morning.time, 'morning'),
      },
      evening: {
        enabled: values.evening.enabled,
        notificationId: null,
        time: sanitizeTime(values.evening.time, 'evening'),
      },
    };
    await this.storage.setItem(key, JSON.stringify(settings));
  }

  async update(
    parentId: string,
    childProfileId: string,
    slot: ReminderSlot,
    update: Readonly<{ enabled?: boolean; time?: string }>,
  ): Promise<{ permissionDenied: boolean; settings: BrushingReminderSettings }> {
    const current = await this.get(parentId, childProfileId);
    const previous = current[slot];
    const desired = { ...previous, ...update };
    if (!timePattern.test(desired.time)) throw new Error('INVALID_REMINDER_TIME');

    if (desired.enabled) {
      let permission = await this.notifications.getPermission();
      if (permission === 'undetermined') permission = await this.notifications.requestPermission();
      if (permission !== 'granted') return { permissionDenied: true, settings: current };
    }

    if (previous.notificationId) await this.notifications.cancel(previous.notificationId);
    // Persist only the child-specific preference. The caller immediately
    // rebuilds the single canonical grouped OS schedule across all children.
    const settings = { ...current, [slot]: { ...desired, notificationId: null } };
    await this.storage.setItem(storageKey(parentId, childProfileId), JSON.stringify(settings));
    return { permissionDenied: false, settings };
  }

  /**
   * Removes the device-local per-child schedule handles before the canonical
   * grouped schedule is rebuilt. Enabled/time preferences remain untouched.
   */
  async clearScheduledNotificationIds(
    parentId: string,
    childProfileId: string,
  ): Promise<BrushingReminderSettings> {
    const current = await this.get(parentId, childProfileId);
    for (const slot of ['morning', 'evening'] as const) {
      const notificationId = current[slot].notificationId;
      if (notificationId) await this.notifications.cancel(notificationId).catch(() => undefined);
    }
    const cleared: BrushingReminderSettings = {
      morning: { ...current.morning, notificationId: null },
      evening: { ...current.evening, notificationId: null },
    };
    // Only rewrite a child that actually has a stored record (a real saved
    // preference, or one just seeded from the legacy parent-level record by
    // get()). A child that has never saved a reminder must NOT get a fabricated
    // defaults record persisted here: that would flip hasStoredSettings() to
    // true and expose the child to cloud-recovery overwrites, and would also
    // push 08:00 / 20:30 to the cloud as if it were a real preference.
    if (await this.hasStoredSettings(parentId, childProfileId)) {
      await this.storage.setItem(storageKey(parentId, childProfileId), JSON.stringify(cleared));
    }
    return cleared;
  }

  async scheduleDevelopmentTest(): Promise<{ permissionDenied: boolean }> {
    let permission = await this.notifications.getPermission();
    if (permission === 'undetermined') permission = await this.notifications.requestPermission();
    if (permission !== 'granted') return { permissionDenied: true };

    await this.notifications.scheduleTest(i18n.t('parent.reminders.testNotificationBody'));
    return { permissionDenied: false };
  }
}

const expoNotificationGateway: NotificationGateway = {
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async getPermission() {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return 'granted';
    return permission.canAskAgain ? 'undetermined' : 'denied';
  },
  async requestPermission() {
    const permission = await Notifications.requestPermissionsAsync();
    return permission.granted ? 'granted' : 'denied';
  },
  async schedule(slot, time, body) {
    const [hourText, minuteText] = time.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('brushing-reminders', {
        importance: Notifications.AndroidImportance.DEFAULT,
        name: i18n.t('parent.reminders.channelName'),
      });
    }
    return Notifications.scheduleNotificationAsync({
      content: {
        body,
        data: { reminderSlot: slot },
        sound: 'default',
        title: i18n.t('parent.reminders.notificationTitle'),
      },
      trigger: {
        channelId: Platform.OS === 'android' ? 'brushing-reminders' : undefined,
        hour,
        minute,
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
      },
    });
  },
  async scheduleTest(body) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('brushing-reminders', {
        importance: Notifications.AndroidImportance.DEFAULT,
        name: i18n.t('parent.reminders.channelName'),
      });
    }
    return Notifications.scheduleNotificationAsync({
      content: {
        body,
        data: { developmentTest: true },
        sound: 'default',
        title: i18n.t('parent.reminders.notificationTitle'),
      },
      trigger: {
        channelId: Platform.OS === 'android' ? 'brushing-reminders' : undefined,
        seconds: 60,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  },
};

export const reminderSettingsService = new ReminderSettingsService();
