import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { appHeaderHeight, minimumTouchTarget } from '@/design-system';

import ParentSettingsScreen from '../settings';

const mockSetBrushingVoiceProfile = jest.fn(
  (_parentUserId: string, _childProfileId: string, _profile: string) => Promise.resolve(),
);
const mockPreviewPlay = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'child-a',
          nickname: 'Ege',
          dateOfBirth: '2020-01-15',
          ageBand: '4_6',
          avatarId: 'inci',
          createdAt: '2026-08-01T00:00:00.000Z',
        }),
      updateProfile: mockUpdateProfile,
    }),
}));
jest.mock('@/features/child-profile', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DateOfBirthField: ({
      label,
      onChange,
      testID,
    }: {
      label: string;
      onChange: (value: string) => void;
      testID: string;
    }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress: () => onChange('2019-08-29'), testID },
        React.createElement(Text, null, label),
      ),
  };
});

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
  ensureVoicePreviewAudioMode: () => Promise.resolve(),
  getBrushingVoiceProfile: () => Promise.resolve('gokce'),
  getNicknamePersonalizationEnabled: () => Promise.resolve(false),
  hasStoredNicknamePersonalization: () => Promise.resolve(false),
  hasStoredVoiceProfile: () => Promise.resolve(true),
  markNicknamePersonalizationSynced: () => Promise.resolve(),
  markVoiceProfileSynced: () => Promise.resolve(),
  readNicknamePersonalizationSyncMeta: () =>
    Promise.resolve({ syncedAt: null, dirty: false }),
  readVoiceProfileSyncMeta: () => Promise.resolve({ syncedAt: null, dirty: false }),
  setBrushingVoiceProfile: (parentUserId: string, childProfileId: string, profile: string) =>
    mockSetBrushingVoiceProfile(parentUserId, childProfileId, profile),
  setNicknamePersonalizationEnabled: () => Promise.resolve(),
}));

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

describe('Parent Settings navigation header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({
      id: 'child-a',
      nickname: 'Ege',
      dateOfBirth: '2019-08-29',
      ageBand: '7_11',
      avatarId: 'inci',
      createdAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('keeps a full-size back target and returns to Parent Account', async () => {
    const view = await render(<ParentSettingsScreen />);
    const back = view.getByTestId('parent-settings-back-button');
    const header = view.getByTestId('app-screen-header');

    expect(StyleSheet.flatten(header.props.style).height).toBe(appHeaderHeight);
    expect(StyleSheet.flatten(back.props.style).height).toBeGreaterThanOrEqual(minimumTouchTarget);
    expect(StyleSheet.flatten(back.props.style).width).toBeGreaterThanOrEqual(minimumTouchTarget);

    await fireEvent.press(back);
    expect(router.replace).toHaveBeenCalledWith('/(parent)');
  });

  it('shows all voice profiles and saves the choice for the active parent', async () => {
    const view = await render(<ParentSettingsScreen />);

    await waitFor(() =>
      expect(view.getByRole('radio', { name: 'Gökçe' }).props.accessibilityState.checked).toBe(
        true,
      ),
    );
    await fireEvent.press(view.getByRole('radio', { name: 'Sam' }));
    expect(mockSetBrushingVoiceProfile).toHaveBeenCalledWith('parent-a', 'child-a', 'samet');
    await waitFor(() =>
      expect(view.getByRole('radio', { name: 'Sam' }).props.accessibilityState.checked).toBe(true),
    );
    expect(view.getByRole('radio', { name: 'Kapalı' })).toBeTruthy();
    expect(view.queryByText('Sıcak ve neşeli kadın sesi')).toBeNull();
    expect(view.queryByText('Dostça erkek sesi')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Gökçe sesini dinle' }));
    await waitFor(() => expect(mockPreviewPlay).toHaveBeenCalledTimes(1));
  });

  it('updates only the active child date of birth from Parent Settings', async () => {
    const view = await render(<ParentSettingsScreen />);
    await waitFor(() => expect(view.getByTestId('parent-date-of-birth')).toBeTruthy());

    await fireEvent.press(view.getByTestId('parent-date-of-birth'));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith('child-a', {
        dateOfBirth: '2019-08-29',
      }),
    );
  });
});
