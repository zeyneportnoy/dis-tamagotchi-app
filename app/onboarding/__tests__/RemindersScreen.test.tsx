import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import OnboardingRemindersScreen from '../reminders';

const mockSetReminderChoice = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    morningReminderTime: '08:00',
    eveningReminderTime: '20:30',
    setReminderChoice: mockSetReminderChoice,
  }),
}));

describe('onboarding reminder choice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a disabled choice on the draft when skipped', async () => {
    const view = await render(<OnboardingRemindersScreen />);

    await fireEvent.press(view.getByTestId('skip-onboarding-reminders'));

    expect(mockSetReminderChoice).toHaveBeenCalledWith({ enabled: false });
    expect(router.push).toHaveBeenCalledWith('/onboarding/dentist-visit');
  });

  it('records the selected times on the draft and defers scheduling to the summary screen', async () => {
    const view = await render(<OnboardingRemindersScreen />);
    await fireEvent.press(view.getByTestId('enable-onboarding-reminders'));
    await fireEvent.press(
      view.getByRole('button', { name: 'Sabah hatırlatıcısı saatini 15 dakika ileri al' }),
    );
    await fireEvent.press(view.getByTestId('save-onboarding-reminders'));

    expect(mockSetReminderChoice).toHaveBeenCalledWith({
      enabled: true,
      morningTime: '08:15',
      eveningTime: '20:30',
    });
    expect(router.push).toHaveBeenCalledWith('/onboarding/dentist-visit');
  });
});
