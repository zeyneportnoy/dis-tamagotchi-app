import { render, waitFor } from '@testing-library/react-native';

import CollectionScreen from '../collection';
import ProfileScreen from '../profile';
import TasksScreen from '../tasks';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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

describe('Child tab routes', () => {
  it.each([
    [TasksScreen, 'tasks-screen', 'Görevler'],
    [CollectionScreen, 'collection-screen', 'Koleksiyon'],
    [ProfileScreen, 'profile-screen', 'Profil'],
  ])('renders a real placeholder route', async (Route, testID, title) => {
    const view = await render(<Route />);
    await waitFor(() => expect(view.getByTestId(testID)).toBeTruthy());
    expect(view.getByText(title)).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Geri' })).toBeNull();
  });
});
