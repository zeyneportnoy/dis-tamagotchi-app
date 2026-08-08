import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import AgeBandUpdateScreen from '../age-band-update';

const mockUpdateProfile = jest.fn();

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-legacy',
          nickname: 'Ege',
          ageBand: '6_8',
          avatarId: 'cheerful-incisor',
        }),
      updateProfile: mockUpdateProfile,
    }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

describe('age-band update route', () => {
  beforeEach(() => {
    mockUpdateProfile.mockResolvedValue({});
  });

  it('updates a legacy profile only after an explicit new selection', async () => {
    const view = await render(<AgeBandUpdateScreen />);
    await waitFor(() => expect(view.getByTestId('age-band-update-screen')).toBeTruthy());

    fireEvent.press(view.getByRole('radio', { name: '4–6 yaş' }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith('profile-legacy', { ageBand: '4_6' });
      expect(router.replace).toHaveBeenCalledWith('/(child)');
    });
  });
});
