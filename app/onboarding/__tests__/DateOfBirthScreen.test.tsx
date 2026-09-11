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
    dateOfBirth: null,
    nickname: 'Ege',
    profileId: null,
    setAgeBand: mockSetAgeBand,
    setDateOfBirth: mockSetDateOfBirth,
  }),
}));

describe('date of birth onboarding', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps age bands without requesting birth date and continues directly to the existing character screen', async () => {
    const view = await render(<DateOfBirthScreen />);

    expect(view.queryByTestId('onboarding-date-of-birth')).toBeNull();
    expect(view.getByText('4–6 yaş')).toBeTruthy();
    expect(view.getByText('7–11 yaş')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Devam et' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/character'));
  });
});
