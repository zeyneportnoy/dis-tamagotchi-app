import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import DateOfBirthScreen from '../age-band';

const mockSetAgeBand = jest.fn();
const mockSetDateOfBirth = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/application/family', () => ({ getFamilyUseCases: jest.fn() }));
jest.mock('@/features/child-profile', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DateOfBirthField: ({ label, testID }: { label: string; testID: string }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', testID },
        React.createElement(Text, null, label),
      ),
  };
});
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    ageBand: '4_6',
    avatarId: null,
    dateOfBirth: '2020-01-15',
    nickname: 'Ege',
    profileId: null,
    setAgeBand: mockSetAgeBand,
    setDateOfBirth: mockSetDateOfBirth,
  }),
}));

describe('date of birth onboarding', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a date field and continues directly to the existing character screen', async () => {
    const view = await render(<DateOfBirthScreen />);

    expect(view.getByTestId('onboarding-date-of-birth')).toBeTruthy();
    expect(view.queryByText('4–6 yaş')).toBeNull();
    expect(view.queryByText('7–11 yaş')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Devam et' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/character'));
  });
});
