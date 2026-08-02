import { render, waitFor } from '@testing-library/react-native';

import ChildHomeScreen from '../index';

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-1',
          nickname: 'Ege',
          ageBand: '6_8',
          avatarId: 'cheerful-incisor',
        }),
      listProfiles: () => Promise.resolve([]),
    }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

describe('Child Home route', () => {
  it('renders the Turkish placeholder', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => {
      expect(view.getByTestId('child-home-screen')).toBeTruthy();
      expect(view.getByText('Çocuk ana ekranı bir sonraki adımlarda gelişecek.')).toBeTruthy();
    });
  });
});
