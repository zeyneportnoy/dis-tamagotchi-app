import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import BrushingScreen from '../brushing';

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    pause: jest.fn(),
    play: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'session-abandoned' }));

jest.mock('@/features/auth', () => ({
  useAuth: () => ({ session: { userId: 'parent-a' } }),
}));

const mockCompleteBrushingSession = jest.fn(() =>
  Promise.resolve({ id: 'session-1', completed: true }),
);
const mockAbandonBrushingSession = jest.fn(() => Promise.resolve());
jest.mock('@/application/child', () => ({
  getChildExperienceUseCases: () =>
    Promise.resolve({
      completeBrushingSession: mockCompleteBrushingSession,
      abandonBrushingSession: mockAbandonBrushingSession,
      getProgress: () =>
        Promise.resolve({
          childProfileId: 'profile-1',
          statusDate: '2026-08-09',
          morningCompleted: false,
          eveningCompleted: false,
          currentStreak: 0,
          totalXp: 0,
          level: 1,
          mood: 50,
          lastInteractionAt: null,
          lastBrushingAt: null,
        }),
    }),
}));
jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-1',
          nickname: 'Ege',
          ageBand: '4_6',
          avatarId: 'inci',
        }),
    }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ addListener: jest.fn(() => jest.fn()) }),
}));

describe('Brushing session route', () => {
  it('shows the first region, progress, timer and age-adapted guidance', async () => {
    const view = await render(<BrushingScreen />);
    await waitFor(() => expect(view.getByTestId('brushing-session-screen')).toBeTruthy());
    expect(view.getByText('Sağ üst bölge')).toBeTruthy();
    expect(view.getByText('1 / 4')).toBeTruthy();
    expect(view.getByText(/^(?:29|30)$/)).toBeTruthy();
    expect(view.getByLabelText(/^Toplam (?:119|120) saniye kaldı$/)).toBeTruthy();
    expect(view.getByTestId('character-inci', { includeHiddenElements: true })).toBeTruthy();
    expect(
      view.getByTestId('character-phase-resting', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      view.getByText('Bu bölgedeki dişlerin dışını, içini ve çiğneme yerlerini fırçala.'),
    ).toBeTruthy();
  });

  it('pauses, resumes and confirms early exit without completing a session', async () => {
    const view = await render(<BrushingScreen />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Duraklat' })).toBeTruthy());
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Duraklat' })));
    expect(view.getByTestId('pause-controls')).toBeTruthy();
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Devam et' })));
    expect(view.getByRole('button', { name: 'Duraklat' })).toBeTruthy();
    await act(async () => fireEvent.press(view.getByTestId('brushing-exit-button')));
    expect(view.getByText('Fırçalamadan çıkmak istiyor musun?')).toBeTruthy();
    expect(view.getByText('Bu fırçalama tamamlanmadı olarak kalacak.')).toBeTruthy();
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Devam et' })));
    expect(view.getByRole('button', { name: 'Duraklat' })).toBeTruthy();
    await act(async () => fireEvent.press(view.getByTestId('brushing-exit-button')));
    const exitButton = view.getByRole('button', { name: 'Çık' });
    let resolveAbandon!: () => void;
    mockAbandonBrushingSession.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveAbandon = resolve)),
    );
    act(() => {
      fireEvent.press(exitButton);
      fireEvent.press(exitButton);
    });
    await waitFor(() => expect(mockAbandonBrushingSession).toHaveBeenCalledTimes(1));
    await act(async () => resolveAbandon());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(child)'));
    expect(mockAbandonBrushingSession).toHaveBeenCalledWith(
      expect.any(String),
      'profile-1',
      expect.any(String),
      expect.any(Number),
      undefined,
    );
    expect(mockCompleteBrushingSession).not.toHaveBeenCalled();
  });
});
