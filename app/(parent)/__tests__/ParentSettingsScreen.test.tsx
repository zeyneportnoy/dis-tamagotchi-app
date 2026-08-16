import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { appHeaderHeight, minimumTouchTarget } from '@/design-system';

import ParentSettingsScreen from '../settings';

const mockSetBrushingVoiceProfile = jest.fn((_parentUserId: string, _profile: string) =>
  Promise.resolve(),
);
const mockPreviewPlay = jest.fn();

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({
    pause: jest.fn(),
    play: mockPreviewPlay,
    seekTo: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => ({ session: { userId: 'parent-a' } }),
}));
jest.mock('@/features/brushing', () => ({
  brushingVoiceCues: {
    gokce: [{ source: 1 }],
    samet: [{ source: 2 }],
  },
  getBrushingVoiceProfile: () => Promise.resolve('gokce'),
  setBrushingVoiceProfile: (parentUserId: string, profile: string) =>
    mockSetBrushingVoiceProfile(parentUserId, profile),
}));

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

describe('Parent Settings navigation header', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps a full-size back target and returns to Parent Account', async () => {
    const view = await render(<ParentSettingsScreen />);
    const back = view.getByTestId('parent-settings-back-button');
    const header = view.getByTestId('app-screen-header');

    expect(StyleSheet.flatten(header.props.style).height).toBe(appHeaderHeight);
    expect(StyleSheet.flatten(back.props.style).height).toBeGreaterThanOrEqual(minimumTouchTarget);
    expect(StyleSheet.flatten(back.props.style).width).toBeGreaterThanOrEqual(minimumTouchTarget);

    fireEvent.press(back);
    expect(router.replace).toHaveBeenCalledWith('/(parent)');
  });

  it('shows all voice profiles and saves the choice for the active parent', async () => {
    const view = await render(<ParentSettingsScreen />);

    await waitFor(() =>
      expect(view.getByRole('radio', { name: 'Gökçe' }).props.accessibilityState.checked).toBe(
        true,
      ),
    );
    fireEvent.press(view.getByRole('radio', { name: 'Samet' }));
    expect(mockSetBrushingVoiceProfile).toHaveBeenCalledWith('parent-a', 'samet');
    await waitFor(() =>
      expect(view.getByRole('radio', { name: 'Samet' }).props.accessibilityState.checked).toBe(
        true,
      ),
    );
    expect(view.getByRole('radio', { name: 'Kapalı' })).toBeTruthy();
    expect(view.queryByText('Sıcak ve neşeli kadın sesi')).toBeNull();
    expect(view.queryByText('Dostça erkek sesi')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Gökçe sesini dinle' }));
    await waitFor(() => expect(mockPreviewPlay).toHaveBeenCalledTimes(1));
  });
});
