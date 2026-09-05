import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import SummaryScreen from '../summary';
import { setBrushingVoiceProfile } from '@/features/brushing';
import { dentistReminderService } from '@/features/reminders';

const mockCreateProfile = jest.fn();
const mockListProfiles = jest.fn();
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
  getFamilyUseCases: () =>
    Promise.resolve({ createProfile: mockCreateProfile, listProfiles: mockListProfiles }),
}));
jest.mock('@/application/sync', () => ({
  getProfileSyncUseCases: () => Promise.resolve({ claimLegacyProfiles: mockClaimLegacyProfiles }),
  syncAllChildPreferences: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/auth', () => ({ useAuth: () => ({ session: { userId: 'parent-1' } }) }));
jest.mock('@/features/brushing', () => ({
  brushingVoiceCues: {
    gokce: [{ source: 1 }],
    samet: [{ source: 2 }],
  },
  brushingVoiceProfiles: ['gokce', 'samet', 'off'],
  ensureVoicePreviewAudioMode: jest.fn(() => Promise.resolve()),
  setBrushingVoiceProfile: jest.fn(),
}));
jest.mock('@/features/reminders', () => ({
  dentistReminderService: { ensureScheduledForProfile: jest.fn() },
  dentistVisitService: { setLastVisitDate: jest.fn(() => Promise.resolve()) },
  reminderSettingsService: { update: jest.fn(() => Promise.resolve({ permissionDenied: false })) },
  syncGroupedBrushingReminders: jest.fn(() => Promise.resolve()),
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

const isCardSelected = (view: ReturnType<typeof render>, profile: string): boolean =>
  view.getByTestId(`onboarding-voice-${profile}`).props.accessibilityState.checked === true;

const confirmDisabled = (view: ReturnType<typeof render>): boolean =>
  view.getByTestId('create-profile-button').props.disabled === true;

describe('profile summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProfile.mockResolvedValue({ id: 'profile-1', nickname: 'Ege' });
    mockListProfiles.mockResolvedValue([]);
    mockClaimLegacyProfiles.mockResolvedValue(undefined);
    mockSetVoiceProfile.mockResolvedValue(undefined);
    mockEnsureDentistReminder.mockResolvedValue({
      firstDueAt: '2027-02-28T09:30:00.000Z',
      scheduled: true,
    });
  });

  it('starts with no voice selected and "Onayla" disabled', async () => {
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-gokce')).toBeTruthy());

    for (const profile of ['gokce', 'samet', 'off']) {
      expect(isCardSelected(view, profile)).toBe(false);
    }
    expect(confirmDisabled(view)).toBe(true);
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockSetVoiceProfile).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('tapping a voice only highlights it and enables "Onayla" — no save/create/navigation yet', async () => {
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-samet')).toBeTruthy());

    await fireEvent.press(view.getByTestId('onboarding-voice-samet'));

    await waitFor(() => expect(isCardSelected(view, 'samet')).toBe(true));
    expect(isCardSelected(view, 'gokce')).toBe(false);
    expect(isCardSelected(view, 'off')).toBe(false);
    expect(confirmDisabled(view)).toBe(false);
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockSetVoiceProfile).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('lets the user change the selected voice before confirming', async () => {
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-gokce')).toBeTruthy());

    await fireEvent.press(view.getByTestId('onboarding-voice-gokce'));
    await fireEvent.press(view.getByTestId('onboarding-voice-off'));

    await waitFor(() => expect(isCardSelected(view, 'off')).toBe(true));
    expect(isCardSelected(view, 'gokce')).toBe(false);
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() =>
      expect(mockSetVoiceProfile).toHaveBeenCalledWith('parent-1', 'profile-1', 'off'),
    );
    expect(router.replace).toHaveBeenCalledWith('/(child)');
  });

  it('previews voices with "Dinle" without selecting them or advancing onboarding', async () => {
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-gokce')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Gökçe sesini dinle' }));
    await waitFor(() => expect(mockGokcePreview.play).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByRole('button', { name: 'Sam sesini dinle' }));
    await waitFor(() => expect(mockSametPreview.play).toHaveBeenCalledTimes(1));

    expect(view.queryByRole('button', { name: 'Kapalı sesini dinle' })).toBeNull();
    expect(isCardSelected(view, 'gokce')).toBe(false);
    expect(isCardSelected(view, 'samet')).toBe(false);
    expect(confirmDisabled(view)).toBe(true);
    expect(mockSetVoiceProfile).not.toHaveBeenCalled();
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('runs the existing create/save/navigation flow with the selected voice only on "Onayla"', async () => {
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-samet')).toBeTruthy());

    await fireEvent.press(view.getByTestId('onboarding-voice-samet'));
    expect(mockCreateProfile).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() =>
      expect(mockCreateProfile).toHaveBeenCalledWith({
        avatarId: 'inci',
        dateOfBirth: '2020-01-15',
        nickname: 'Ege',
      }),
    );
    expect(mockSetVoiceProfile).toHaveBeenCalledWith('parent-1', 'profile-1', 'samet');
    expect(mockEnsureDentistReminder).toHaveBeenCalledWith({ id: 'profile-1', nickname: 'Ege' });
    expect(mockReset).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(child)');
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
    expect(view.getByRole('radio', { name: 'Sam' })).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Kapalı' })).toBeTruthy();
  });

  it('does not strand the user when deferred cloud sync is unavailable', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-2', nickname: 'Ege' });
    mockClaimLegacyProfiles.mockRejectedValue(new Error('OFFLINE'));
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-gokce')).toBeTruthy());

    await fireEvent.press(view.getByTestId('onboarding-voice-gokce'));
    await fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(child)'));
  });

  it('opens Home without waiting for deferred cloud sync', async () => {
    mockCreateProfile.mockResolvedValue({ id: 'profile-3', nickname: 'Ege' });
    mockClaimLegacyProfiles.mockReturnValue(new Promise(() => undefined));
    const view = await render(<SummaryScreen />);
    await waitFor(() => expect(view.getByTestId('onboarding-voice-gokce')).toBeTruthy());

    await fireEvent.press(view.getByTestId('onboarding-voice-gokce'));
    await fireEvent.press(view.getByTestId('create-profile-button'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(child)'));
  });
});
