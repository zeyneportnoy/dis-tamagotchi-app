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

// Mirror how the rest of the codebase mocks the native picker: render a plain
// View that forwards every prop, so tests can read `mode` / `minuteInterval` and
// drive the `change` event.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: object) => React.createElement(View, props),
  };
});

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

  it('opens a morning/evening time control backed by the exact-minute picker and updates the shown time on confirm', async () => {
    const view = await render(<OnboardingRemindersScreen />);
    await fireEvent.press(view.getByTestId('enable-onboarding-reminders'));

    // Both slots expose a tappable time control seeded from the draft.
    expect(view.getByTestId('morning-onboarding-time-picker')).toBeTruthy();
    expect(view.getByTestId('evening-onboarding-time-picker')).toBeTruthy();
    expect(view.getByText('08:00')).toBeTruthy();

    // Opening it shows the native time picker at 1-minute precision (no stepping).
    await fireEvent.press(view.getByTestId('morning-onboarding-time-picker'));
    const picker = view.getByTestId('onboarding-reminder-native-time-picker');
    expect(picker.props.mode).toBe('time');
    expect(picker.props.minuteInterval).toBe(1);
    expect(picker.props.value.getHours()).toBe(8);
    expect(picker.props.value.getMinutes()).toBe(0);

    // An arbitrary, non-15-multiple minute can be selected and confirmed.
    await fireEvent(picker, 'change', { type: 'set' }, new Date(2020, 0, 1, 8, 7));
    await fireEvent.press(view.getByRole('button', { name: 'Bitti' }));

    expect(view.getByText('08:07')).toBeTruthy();
    expect(view.queryByText('08:00')).toBeNull();
    // Nothing is persisted until the screen's save button is pressed.
    expect(mockSetReminderChoice).not.toHaveBeenCalled();
  });

  it('records the exact-minute morning and evening times on the draft and continues to the dentist step', async () => {
    const view = await render(<OnboardingRemindersScreen />);
    await fireEvent.press(view.getByTestId('enable-onboarding-reminders'));

    await fireEvent.press(view.getByTestId('morning-onboarding-time-picker'));
    await fireEvent(
      view.getByTestId('onboarding-reminder-native-time-picker'),
      'change',
      { type: 'set' },
      new Date(2020, 0, 1, 8, 7),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Bitti' }));

    await fireEvent.press(view.getByTestId('evening-onboarding-time-picker'));
    await fireEvent(
      view.getByTestId('onboarding-reminder-native-time-picker'),
      'change',
      { type: 'set' },
      new Date(2020, 0, 1, 20, 41),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Bitti' }));

    await fireEvent.press(view.getByTestId('save-onboarding-reminders'));

    expect(mockSetReminderChoice).toHaveBeenCalledWith({
      enabled: true,
      morningTime: '08:07',
      eveningTime: '20:41',
    });
    expect(router.push).toHaveBeenCalledWith('/onboarding/dentist-visit');
  });

  it('keeps the draft times when the picker is dismissed without confirming', async () => {
    const view = await render(<OnboardingRemindersScreen />);
    await fireEvent.press(view.getByTestId('enable-onboarding-reminders'));

    await fireEvent.press(view.getByTestId('morning-onboarding-time-picker'));
    await fireEvent(
      view.getByTestId('onboarding-reminder-native-time-picker'),
      'change',
      { type: 'dismissed' },
      undefined,
    );
    await fireEvent.press(view.getByTestId('save-onboarding-reminders'));

    expect(mockSetReminderChoice).toHaveBeenCalledWith({
      enabled: true,
      morningTime: '08:00',
      eveningTime: '20:30',
    });
  });
});
