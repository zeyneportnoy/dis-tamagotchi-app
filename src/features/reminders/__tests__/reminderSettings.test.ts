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
  return {
    notifications,
    service: new ReminderSettingsService(storage, notifications),
    storage,
    values,
  };
}

describe('per-child brushing reminders', () => {
  it('requests permission only when a reminder is first enabled', async () => {
    const { notifications, service } = createHarness('undetermined');
    await service.get('parent-a', 'child-a');
    expect(notifications.getPermission).not.toHaveBeenCalled();

    const result = await service.update('parent-a', 'child-a', 'morning', {
      enabled: true,
      time: '08:15',
    });
    expect(notifications.requestPermission).toHaveBeenCalledTimes(1);
    expect(result.settings.morning.enabled).toBe(true);
  });

  it('does not enable when permission is denied', async () => {
    const { notifications, service } = createHarness('denied');
    const result = await service.update('parent-a', 'child-a', 'morning', { enabled: true });
    expect(result.permissionDenied).toBe(true);
    expect(result.settings.morning.enabled).toBe(false);
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it('cancels the old schedule on time changes and disabling', async () => {
    const { notifications, service } = createHarness();
    await service.update('parent-a', 'child-a', 'evening', { enabled: true, time: '20:30' });
    const changed = await service.update('parent-a', 'child-a', 'evening', { time: '21:10' });
    expect(notifications.cancel).toHaveBeenCalledWith('notification-1');
    expect(changed.settings.evening.notificationId).toBe('notification-2');

    const disabled = await service.update('parent-a', 'child-a', 'evening', { enabled: false });
    expect(notifications.cancel).toHaveBeenCalledWith('notification-2');
    expect(disabled.settings.evening.enabled).toBe(false);
    expect(disabled.settings.evening.notificationId).toBeNull();
  });

  it('isolates two children of the same parent', async () => {
    const { service } = createHarness();
    await service.update('parent-a', 'child-a', 'morning', { enabled: true, time: '08:00' });
    await service.update('parent-a', 'child-a', 'evening', { enabled: true, time: '20:00' });
    await service.update('parent-a', 'child-b', 'morning', { enabled: true, time: '09:00' });
    await service.update('parent-a', 'child-b', 'evening', { enabled: true, time: '21:00' });

    expect((await service.get('parent-a', 'child-a')).morning.time).toBe('08:00');
    expect((await service.get('parent-a', 'child-a')).evening.time).toBe('20:00');
    expect((await service.get('parent-a', 'child-b')).morning.time).toBe('09:00');
    expect((await service.get('parent-a', 'child-b')).evening.time).toBe('21:00');
  });

  it('seeds a child from the legacy parent-level record without deleting it', async () => {
    const harness = createHarness();
    harness.values.set(
      'parent:parent-a:brushing-reminders:v1',
      JSON.stringify({
        morning: { enabled: true, notificationId: 'legacy-1', time: '07:45' },
        evening: { enabled: false, notificationId: null, time: '20:30' },
      }),
    );
    expect(await harness.service.hasStoredSettings('parent-a', 'child-a')).toBe(false);
    expect((await harness.service.get('parent-a', 'child-a')).morning).toMatchObject({
      enabled: true,
      time: '07:45',
    });
    expect(await harness.service.hasStoredSettings('parent-a', 'child-a')).toBe(true);
    expect(harness.values.get('parent:parent-a:brushing-reminders:v1')).toContain('07:45');
  });

  it('applyRecoveredPreferences persists values and schedules enabled slots once', async () => {
    const { notifications, service } = createHarness();
    await service.applyRecoveredPreferences('parent-a', 'child-a', {
      morning: { enabled: true, time: '07:15' },
      evening: { enabled: false, time: '21:00' },
    });
    expect(notifications.schedule).toHaveBeenCalledTimes(1);
    const stored = await service.get('parent-a', 'child-a');
    expect(stored.morning).toMatchObject({ enabled: true, time: '07:15', notificationId: 'notification-1' });
    expect(stored.evening.enabled).toBe(false);
    // hasStoredSettings is now true, so recovery will not run (or re-schedule) again.
    expect(await service.hasStoredSettings('parent-a', 'child-a')).toBe(true);
  });

  it('applyRecoveredPreferences keeps enabled=true without scheduling when permission is not granted', async () => {
    const { notifications, service } = createHarness('denied');
    await service.applyRecoveredPreferences('parent-a', 'child-a', {
      morning: { enabled: true, time: '07:15' },
      evening: { enabled: true, time: '21:00' },
    });
    expect(notifications.schedule).not.toHaveBeenCalled();
    const stored = await service.get('parent-a', 'child-a');
    expect(stored.morning.enabled).toBe(true);
    expect(stored.morning.notificationId).toBeNull();
    expect(stored.evening.enabled).toBe(true);
  });

  it('schedules the development test notification without changing reminder settings', async () => {
    const { notifications, service } = createHarness();
    const before = await service.get('parent-a', 'child-a');

    await expect(service.scheduleDevelopmentTest()).resolves.toEqual({ permissionDenied: false });
    expect(notifications.scheduleTest).toHaveBeenCalledWith(
      'Bu bir geliştirme testi. Fırçalama hatırlatıcıları çalışıyor.',
    );
    await expect(service.get('parent-a', 'child-a')).resolves.toEqual(before);
  });
});
