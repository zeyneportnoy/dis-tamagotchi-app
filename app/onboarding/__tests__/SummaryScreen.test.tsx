import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import SummaryScreen from '../summary';
import { setBrushingVoiceProfile } from '@/features/brushing';
import { dentistReminderService } from '@/features/reminders';

const mockCreateProfile = jest.fn();
const mockClaimLegacyProfiles = jest.fn();
const mockReset = jest.fn();
const mockGokcePreview = {
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
};
const mockSametPreview = {
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
};

jest.mock('expo-audio', () => ({
  useAudioPlayer: (source: number) => (source === 1 ? mockGokcePreview : mockSametPreview),
}));

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/application/family', () => ({
  getFamilyUseCases: () => Promise.resolve({ createProfile: mockCreateProfile }),
}));
jest.mock('@/application/sync', () => ({
  getProfileSyncUseCases: () => Promise.resolve({ claimLegacyProfiles: mockClaimLegacyProfiles }),
}));
jest.mock('@/features/auth', () => ({ useAuth: () => ({ session: { userId: 'parent-1' } }) }));
jest.mock('@/features/brushing', () => ({
  brushingVoiceCues: {
    gokce: [{ source: 1 }],
    samet: [{ source: 2 }],
  },
  brushingVoiceProfiles: ['gokce', 'samet', 'off'],
  setBrushingVoiceProfile: jest.fn(),
}));
jest.mock('@/features/reminders', () => ({
  dentistReminderService: { ensureScheduledForProfile: jest.fn() },
  reminderSettingsService: { update: jest.fn(() => Promise.resolve({ permissionDenied: false })) },
}));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    ageBand: '4_6',
    avatarId: 'inci',
    dateOfBirth: '2020-01-15',
    nickname: 'Ege',
    remindersEnabled: false,
    morningReminderTime: '08:00',
    eveningReminderTime: '20:30',
    reset: mockReset,
  }),
}));

const mockSetVoiceProfile = jest.mocked(setBrushingVoiceProfile);
const mockEnsureDentistReminder = jest.mocked(dentistReminderService.ensureScheduledForProfile);

describe('profile summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetVoiceProfile.mockResolvedValue(undefined);
    mockEnsureDentistReminder.mockResolvedValue({
      firstDueAt: '2027-02-28T09:30:00.000Z',
      scheduled: true,
    });
  });

  it('creates the selected profile and opens Home', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-1', nickname: 'Ege' });
    mockClaimLegacyProfiles.mockResolvedValue(undefined);
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('create-profile-button')).toBeTruthy());

    await fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() =>
      expect(mockCreateProfile).toHaveBeenCalledWith({
        avatarId: 'inci',
        dateOfBirth: '2020-01-15',
        nickname: 'Ege',
      }),
    );
    expect(mockReset).toHaveBeenCalled();
    expect(mockSetVoiceProfile).toHaveBeenCalledWith('parent-1', 'profile-1', 'gokce');
    expect(mockEnsureDentistReminder).toHaveBeenCalledWith({
      id: 'profile-1',
      nickname: 'Ege',
    });
    expect(router.replace).toHaveBeenCalledWith('/(child)');
  });

  it.each(['gokce', 'samet', 'off'] as const)(
    'persists %s and advances onboarding when its option is selected',
    async (profile) => {
      mockCreateProfile.mockResolvedValue({ id: `profile-${profile}`, nickname: 'Ege' });
      const view = await render(<SummaryScreen />);
      await waitFor(() => expect(view.getByTestId(`onboarding-voice-${profile}`)).toBeTruthy());

      await fireEvent.press(view.getByTestId(`onboarding-voice-${profile}`));

      await waitFor(() =>
        expect(mockSetVoiceProfile).toHaveBeenCalledWith('parent-1', `profile-${profile}`, profile),
      );
      expect(router.replace).toHaveBeenCalledWith('/(child)');
    },
  );

  it('plays both existing demos without changing the selection or advancing onboarding', async () => {
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-gokce')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Gökçe sesini dinle' }));
    await waitFor(() => expect(mockGokcePreview.play).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByRole('button', { name: 'Samet sesini dinle' }));
    await waitFor(() => expect(mockSametPreview.play).toHaveBeenCalledTimes(1));

    expect(view.queryByRole('button', { name: 'Kapalı sesini dinle' })).toBeNull();
    expect(mockSetVoiceProfile).not.toHaveBeenCalled();
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps every voice option reachable in a vertically scrollable safe-area layout', async () => {
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-off')).toBeTruthy());

    const screenScroll = view.getByTestId('voice-onboarding-scroll');
    expect(screenScroll.props.horizontal).not.toBe(true);
    expect(StyleSheet.flatten(screenScroll.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      paddingBottom: 24,
    });
    expect(view.getByRole('radio', { name: 'Gökçe' })).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Samet' })).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Kapalı' })).toBeTruthy();
  });

  it('does not strand the user when deferred cloud sync is unavailable', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-2', nickname: 'Ege' });
    mockClaimLegacyProfiles.mockRejectedValue(new Error('OFFLINE'));
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('create-profile-button')).toBeTruthy());

    await fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(child)'));
  });

  it('opens Home without waiting for deferred cloud sync', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-3', nickname: 'Ege' });
    mockClaimLegacyProfiles.mockReturnValue(new Promise(() => undefined));
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('create-profile-button')).toBeTruthy());

    await fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(child)'));
  });
});
