import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import CharacterScreen from '../character';

const mockUpdateProfile = jest.fn(() => Promise.resolve());
const mockReset = jest.fn();
const mockSetAvatarId = jest.fn();

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () => Promise.resolve({ updateProfile: mockUpdateProfile }),
}));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    profileId: 'child-b',
    nickname: 'Ada',
    ageBand: '7_11',
    avatarId: null,
    reset: mockReset,
    setAvatarId: mockSetAvatarId,
  }),
}));
jest.mock('@/features/character', () => ({
  CharacterAvatar: () => null,
  CharacterScreenBackdrop: () => null,
  CharacterSceneDecor: () => null,
  sceneBackgroundForCharacter: () => '#FFF6FB',
  sceneToneForCharacter: () => 'blue',
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

describe('existing profile character selection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates only the selected child and opens its Home', async () => {
    const view = await render(<CharacterScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Devam et' }));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith('child-b', { avatarId: 'inci' }),
    );
    expect(mockReset).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(child)');
  });
});
