import { ReminderSettingsService } from '../reminderSettings';

function createHarness(permission: 'granted' | 'denied' | 'undetermined' = 'granted') {
  const values = new Map<string, string>();
  let nextId = 0;
  const storage = {
    getItem: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    }),
  };
  const notifications = {
    cancel: jest.fn(() => Promise.resolve()),
    getPermission: jest.fn(() => Promise.resolve(permission)),
    requestPermission: jest.fn(() => Promise.resolve<'granted' | 'denied'>('granted')),
    schedule: jest.fn(() => Promise.resolve(`notification-${(nextId += 1)}`)),
    scheduleTest: jest.fn(() => Promise.resolve(`test-notification-${(nextId += 1)}`)),
  };
  return { notifications, service: new ReminderSettingsService(storage, notifications), storage };
}

describe('parent brushing reminders', () => {
  it('requests permission only when a reminder is first enabled', async () => {
    const { notifications, service } = createHarness('undetermined');
    await service.get('parent-a');
    expect(notifications.getPermission).not.toHaveBeenCalled();

    const result = await service.update('parent-a', 'morning', { enabled: true, time: '08:15' });
    expect(notifications.requestPermission).toHaveBeenCalledTimes(1);
    expect(result.settings.morning.enabled).toBe(true);
  });

  it('does not enable when permission is denied', async () => {
    const { notifications, service } = createHarness('denied');
    const result = await service.update('parent-a', 'morning', { enabled: true });
    expect(result.permissionDenied).toBe(true);
    expect(result.settings.morning.enabled).toBe(false);
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it('cancels the old schedule on time changes and disabling', async () => {
    const { notifications, service } = createHarness();
    await service.update('parent-a', 'evening', { enabled: true, time: '20:30' });
    const changed = await service.update('parent-a', 'evening', { time: '21:10' });
    expect(notifications.cancel).toHaveBeenCalledWith('notification-1');
    expect(changed.settings.evening.notificationId).toBe('notification-2');

    const disabled = await service.update('parent-a', 'evening', { enabled: false });
    expect(notifications.cancel).toHaveBeenCalledWith('notification-2');
    expect(disabled.settings.evening.enabled).toBe(false);
    expect(disabled.settings.evening.notificationId).toBeNull();
  });

  it('persists across service restarts and isolates parents', async () => {
    const harness = createHarness();
    await harness.service.update('parent-a', 'morning', { enabled: true, time: '07:45' });
    const restarted = new ReminderSettingsService(harness.storage, harness.notifications);
    expect((await restarted.get('parent-a')).morning).toMatchObject({
      enabled: true,
      time: '07:45',
    });
    expect((await restarted.get('parent-b')).morning).toMatchObject({
      enabled: false,
      time: '08:00',
    });
  });

  it('schedules the development test notification without changing reminder settings', async () => {
    const { notifications, service } = createHarness();
    const before = await service.get('parent-a');

    await expect(service.scheduleDevelopmentTest()).resolves.toEqual({ permissionDenied: false });
    expect(notifications.scheduleTest).toHaveBeenCalledWith(
      'Bu bir geliştirme testi. Fırçalama hatırlatıcıları çalışıyor.',
    );
    await expect(service.get('parent-a')).resolves.toEqual(before);
  });
});
