import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import OnboardingRemindersScreen from '../reminders';
import { reminderSettingsService } from '@/features/reminders';

const mockSettings = {
  evening: { enabled: false, notificationId: null, time: '20:30' },
  morning: { enabled: false, notificationId: null, time: '08:00' },
};

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/auth', () => ({ useAuth: () => ({ session: { userId: 'parent-1' } }) }));
jest.mock('@/features/reminders', () => ({
  defaultReminderSettings: {
    evening: { enabled: false, notificationId: null, time: '20:30' },
    morning: { enabled: false, notificationId: null, time: '08:00' },
  },
  reminderSettingsService: { get: jest.fn(), update: jest.fn() },
}));

const mockGet = jest.mocked(reminderSettingsService.get);
const mockUpdate = jest.mocked(reminderSettingsService.update);

describe('onboarding reminder choice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(mockSettings);
    mockUpdate.mockResolvedValue({ permissionDenied: false, settings: mockSettings });
  });

  it('continues without changing existing reminder preferences when skipped', async () => {
    const view = await render(<OnboardingRemindersScreen />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('parent-1'));

    await fireEvent.press(view.getByTestId('skip-onboarding-reminders'));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/onboarding/summary');
  });

  it('uses the existing reminder service for both selected times', async () => {
    const view = await render(<OnboardingRemindersScreen />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('parent-1'));
    await fireEvent.press(view.getByTestId('enable-onboarding-reminders'));
    await fireEvent.press(
      view.getByRole('button', { name: 'Sabah hatırlatıcısı saatini 15 dakika ileri al' }),
    );
    await fireEvent.press(view.getByTestId('save-onboarding-reminders'));

    expect(mockUpdate).toHaveBeenNthCalledWith(1, 'parent-1', 'morning', {
      enabled: true,
      time: '08:15',
    });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, 'parent-1', 'evening', {
      enabled: true,
      time: '20:30',
    });
    expect(router.push).toHaveBeenCalledWith('/onboarding/summary');
  });
});
