import * as Notifications from 'expo-notifications';

import { birthdayReminderService } from '../birthdayReminder';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled-id'),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
}));

const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;

describe('birthdayReminderService — birth dates are no longer collected', () => {
  beforeEach(() => {
    cancel.mockClear();
    schedule.mockClear();
  });

  it('cancels any previously-scheduled birthday notification and schedules no new one, even with a dateOfBirth', async () => {
    await birthdayReminderService.scheduleForProfile({
      id: 'child-1',
      nickname: 'Ege',
      dateOfBirth: '2020-01-15', // a stale value a prior app version may still hold
    });

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith('birthday-child-1');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('cancels and schedules nothing when dateOfBirth is null (the current, normal case)', async () => {
    await birthdayReminderService.scheduleForProfile({
      id: 'child-2',
      nickname: 'Zeynep',
      dateOfBirth: null,
    });

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith('birthday-child-2');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('cancelForProfile cancels the stable per-child identifier directly', async () => {
    await birthdayReminderService.cancelForProfile('child-3');

    expect(cancel).toHaveBeenCalledWith('birthday-child-3');
    expect(schedule).not.toHaveBeenCalled();
  });
});
