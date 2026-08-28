import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import CharacterScreen from '../character';
import type { AgeBand, StarterAvatarKey } from '@/domain/family';

const mockUpdateProfile = jest.fn(() => Promise.resolve());
const mockReset = jest.fn();
const mockSetAvatarId = jest.fn();
let mockAgeBand: AgeBand = '7_11';
let mockAvatarId: StarterAvatarKey | null = null;
let mockProfileId: string | null = 'child-b';

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () => Promise.resolve({ updateProfile: mockUpdateProfile }),
}));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    profileId: mockProfileId,
    nickname: 'Ada',
    ageBand: mockAgeBand,
    avatarId: mockAvatarId,
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockAgeBand = '7_11';
    mockAvatarId = null;
    mockProfileId = 'child-b';
    mockSetAvatarId.mockImplementation((avatar: StarterAvatarKey) => {
      mockAvatarId = avatar;
    });
  });

  it.each<AgeBand>(['4_6', '7_11'])(
    'keeps the tapped character selected for the %s age group after centering',
    async (ageBand) => {
      mockAgeBand = ageBand;
      const view = await render(<CharacterScreen />);

      await fireEvent.press(view.getByRole('radio', { name: 'Milo' }));
      await fireEvent(view.getByTestId('character-carousel'), 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: 960 } },
      });

      expect(mockSetAvatarId).toHaveBeenLastCalledWith('milo');
    },
  );

  it('moves the arrow selection by exactly one character in either direction', async () => {
    mockAvatarId = 'milo';
    const view = await render(<CharacterScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Sonraki diş' }));
    expect(mockSetAvatarId).toHaveBeenLastCalledWith('zipzip');

    await view.rerender(<CharacterScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Önceki diş' }));
    expect(mockSetAvatarId).toHaveBeenLastCalledWith('milo');
  });

  it('shows the full selected character name on one unclipped line', async () => {
    mockAvatarId = 'milo';
    const view = await render(<CharacterScreen />);

    const characterName = view.getByText('Milo');
    expect(characterName.props.numberOfLines).toBe(1);
    expect(characterName).toHaveStyle({ lineHeight: 34, textAlign: 'center' });
  });

  it('allows short screens to scroll to the continue action with bottom spacing', async () => {
    const view = await render(<CharacterScreen />);

    const screen = view.getByTestId('character-selection-screen');
    expect(screen).toHaveStyle({ paddingTop: 0 });
    expect(screen.props.edges).toMatchObject({ bottom: 'additive', top: 'off' });
    const screenScroll = view.getByTestId('character-selection-scroll');
    expect(screenScroll.props.horizontal).not.toBe(true);
    expect(StyleSheet.flatten(screenScroll.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingBottom: 24,
    });
    expect(view.getByRole('button', { name: 'Devam et' })).toBeTruthy();
  });

  it('opens reminder setup after a new profile character is selected', async () => {
    mockProfileId = null;
    mockAvatarId = 'milo';
    const view = await render(<CharacterScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Devam et' }));

    expect(router.push).toHaveBeenCalledWith('/onboarding/reminders');
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

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
