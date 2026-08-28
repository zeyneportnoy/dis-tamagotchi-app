import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import ParentAccountScreen from '../index';

const mockProfiles = [
  { id: 'child-a', nickname: 'Ege', ageBand: '4_6', avatarId: 'inci' },
  { id: 'child-b', nickname: 'Ada', ageBand: '7_11', avatarId: null },
] as const;
let mockActiveProfileId = 'child-a';
const mockSelectActiveProfile = jest.fn(async (profileId: string) => {
  mockActiveProfileId = profileId;
});
const mockBeginExistingProfile = jest.fn();
const mockResetDraft = jest.fn();

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve(mockProfiles.find((profile) => profile.id === mockActiveProfileId) ?? null),
      listProfiles: () => Promise.resolve(mockProfiles),
      selectActiveProfile: mockSelectActiveProfile,
    }),
}));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    beginExistingProfile: mockBeginExistingProfile,
    reset: mockResetDraft,
  }),
}));
jest.mock('@/features/auth', () => ({
  useAuth: () => ({
    session: { displayName: 'Veli', email: 'veli@example.com', emailVerified: true },
    useCases: { signOut: jest.fn() },
  }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

describe('Parent Account child selection', () => {
  beforeEach(() => {
    mockActiveProfileId = 'child-a';
    jest.clearAllMocks();
  });

  it('opens Child Home for a complete profile, including when it is already active', async () => {
    const view = await render(<ParentAccountScreen />);
    await view.findByRole('radio', { name: 'Ege' });

    await fireEvent.press(view.getByTestId('parent-child-profile-child-a'));

    await waitFor(() => expect(mockSelectActiveProfile).toHaveBeenCalledWith('child-a'));
    expect(mockResetDraft).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(child)');
    expect(view.queryByText('Çocuk profilini sil?')).toBeNull();
  });

  it('opens character selection for the selected profile when its character is missing', async () => {
    const view = await render(<ParentAccountScreen />);
    await view.findByRole('radio', { name: 'Ada' });

    await fireEvent.press(view.getByTestId('parent-child-profile-child-b'));

    await waitFor(() => expect(mockSelectActiveProfile).toHaveBeenCalledWith('child-b'));
    expect(mockBeginExistingProfile).toHaveBeenCalledWith({
      id: 'child-b',
      nickname: 'Ada',
      ageBand: '7_11',
      avatarId: null,
    });
    expect(router.replace).toHaveBeenCalledWith('/onboarding/character');
  });

  it('opens only the delete confirmation when the inline trash icon is pressed', async () => {
    const view = await render(<ParentAccountScreen />);
    await view.findByRole('radio', { name: 'Ada' });
    const stopPropagation = jest.fn();

    await fireEvent.press(view.getByTestId('delete-child-profile-child-b'), {
      stopPropagation,
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(view.getByText('Çocuk profilini sil?')).toBeTruthy();
    expect(
      view.getByText('Ada profilini silmek istediğine emin misin? Bu işlem geri alınamaz.'),
    ).toBeTruthy();
    expect(mockSelectActiveProfile).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('button', { name: 'Vazgeç' }));
    expect(view.queryByText('Çocuk profilini sil?')).toBeNull();
  });
});
