import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import BrushingScreen from '../brushing';

const mockCompleteBrushingSession = jest.fn(() =>
  Promise.resolve({ id: 'session-1', completed: true }),
);

jest.mock('@/application/child', () => ({
  getChildExperienceUseCases: () =>
    Promise.resolve({ completeBrushingSession: mockCompleteBrushingSession }),
}));
jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-1',
          nickname: 'Ege',
          ageBand: '4_6',
          avatarId: 'cheerful-incisor',
        }),
    }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useNavigation: () => ({ addListener: jest.fn(() => jest.fn()) }),
}));

describe('Brushing session route', () => {
  it('shows the first region, progress, timer and age-adapted guidance', async () => {
    const view = await render(<BrushingScreen />);
    await waitFor(() => expect(view.getByTestId('brushing-session-screen')).toBeTruthy());
    expect(view.getByText('Sağ üst bölge')).toBeTruthy();
    expect(view.getByText('1 / 4')).toBeTruthy();
    expect(view.getByText('30')).toBeTruthy();
    expect(view.getByLabelText('Toplam 120 saniye kaldı')).toBeTruthy();
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
    expect(view.getByText('Fırçalamayı bırakmak istiyor musun?')).toBeTruthy();
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Çık' })));
    expect(router.back).toHaveBeenCalled();
    expect(mockCompleteBrushingSession).not.toHaveBeenCalled();
  });
});
