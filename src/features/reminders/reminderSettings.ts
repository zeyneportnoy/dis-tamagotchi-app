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

const storageKey = (parentId: string) => `parent:${parentId}:brushing-reminders:v1`;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

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

  async get(parentId: string): Promise<BrushingReminderSettings> {
    return parseSettings(await this.storage.getItem(storageKey(parentId)));
  }

  /** True once reminder settings have been explicitly stored (gates cloud recovery). */
  async hasStoredSettings(parentId: string): Promise<boolean> {
    return (await this.storage.getItem(storageKey(parentId))) !== null;
  }

  /**
   * Writes reminder preference values (enabled + time) without touching local
   * notification scheduling. Used only by cloud recovery when nothing is stored
   * locally yet; a later `update()` reschedules on device.
   */
  async hydratePreferences(
    parentId: string,
    values: Readonly<Record<ReminderSlot, Readonly<{ enabled: boolean; time: string }>>>,
  ): Promise<void> {
    const settings: BrushingReminderSettings = {
      morning: {
        enabled: values.morning.enabled,
        notificationId: null,
        time: timePattern.test(values.morning.time)
          ? values.morning.time
          : defaultReminderSettings.morning.time,
      },
      evening: {
        enabled: values.evening.enabled,
        notificationId: null,
        time: timePattern.test(values.evening.time)
          ? values.evening.time
          : defaultReminderSettings.evening.time,
      },
    };
    await this.storage.setItem(storageKey(parentId), JSON.stringify(settings));
  }

  async update(
    parentId: string,
    slot: ReminderSlot,
    update: Readonly<{ enabled?: boolean; time?: string }>,
  ): Promise<{ permissionDenied: boolean; settings: BrushingReminderSettings }> {
    const current = await this.get(parentId);
    const previous = current[slot];
    const desired = { ...previous, ...update };
    if (!timePattern.test(desired.time)) throw new Error('INVALID_REMINDER_TIME');

    if (desired.enabled) {
      let permission = await this.notifications.getPermission();
      if (permission === 'undetermined') permission = await this.notifications.requestPermission();
      if (permission !== 'granted') return { permissionDenied: true, settings: current };
    }

    if (previous.notificationId) await this.notifications.cancel(previous.notificationId);
    const notificationId = desired.enabled
      ? await this.notifications.schedule(
          slot,
          desired.time,
          i18n.t(`parent.reminders.messages.${slot}.0`),
        )
      : null;
    const settings = { ...current, [slot]: { ...desired, notificationId } };
    await this.storage.setItem(storageKey(parentId), JSON.stringify(settings));
    return { permissionDenied: false, settings };
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
