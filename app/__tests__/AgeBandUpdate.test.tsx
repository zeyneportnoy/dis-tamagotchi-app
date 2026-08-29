import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import DateOfBirthUpdateRedirect from '../age-band-update';

const mockBeginExistingProfile = jest.fn();

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-legacy',
          nickname: 'Ege',
          dateOfBirth: null,
          ageBand: '6_8',
          avatarId: 'inci',
        }),
    }),
}));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({ beginExistingProfile: mockBeginExistingProfile }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

describe('date of birth update route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a legacy profile to the required date picker without asking for an age band', async () => {
    await render(<DateOfBirthUpdateRedirect />);

    await waitFor(() => {
      expect(mockBeginExistingProfile).toHaveBeenCalledWith({
        id: 'profile-legacy',
        nickname: 'Ege',
        dateOfBirth: null,
        ageBand: null,
        avatarId: 'inci',
      });
      expect(router.replace).toHaveBeenCalledWith('/onboarding/age-band');
    });
  });
});
