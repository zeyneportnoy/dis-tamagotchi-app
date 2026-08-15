import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import SummaryScreen from '../summary';

const mockCreateProfile = jest.fn();
const mockClaimLegacyProfiles = jest.fn();
const mockReset = jest.fn();

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/application/family', () => ({
  getFamilyUseCases: () => Promise.resolve({ createProfile: mockCreateProfile }),
}));
jest.mock('@/application/sync', () => ({
  getProfileSyncUseCases: () => Promise.resolve({ claimLegacyProfiles: mockClaimLegacyProfiles }),
}));
jest.mock('@/features/auth', () => ({ useAuth: () => ({ session: { userId: 'parent-1' } }) }));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    ageBand: '4_6',
    avatarId: 'inci',
    nickname: 'Ege',
    reset: mockReset,
  }),
}));

describe('profile summary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the selected profile and opens Home', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-1' });
    mockClaimLegacyProfiles.mockResolvedValue(undefined);
    const view = await render(<SummaryScreen />);

    fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() =>
      expect(mockCreateProfile).toHaveBeenCalledWith({
        ageBand: '4_6',
        avatarId: 'inci',
        nickname: 'Ege',
      }),
    );
    expect(mockReset).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(child)');
  });

  it('does not strand the user when deferred cloud sync is unavailable', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-2' });
    mockClaimLegacyProfiles.mockRejectedValue(new Error('OFFLINE'));
    const view = await render(<SummaryScreen />);

    fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(child)'));
  });

  it('opens Home without waiting for deferred cloud sync', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-3' });
    mockClaimLegacyProfiles.mockReturnValue(new Promise(() => undefined));
    const view = await render(<SummaryScreen />);

    fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(child)'));
  });
});
