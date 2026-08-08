import { render } from '@testing-library/react-native';

import CollectionScreen from '../collection';
import ProfileScreen from '../profile';
import TasksScreen from '../tasks';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('Child tab routes', () => {
  it.each([
    [TasksScreen, 'tasks-screen', 'Görevler'],
    [CollectionScreen, 'collection-screen', 'Koleksiyon'],
    [ProfileScreen, 'profile-screen', 'Profil'],
  ])('renders a real placeholder route', async (Route, testID, title) => {
    const view = await render(<Route />);
    expect(view.getByTestId(testID)).toBeTruthy();
    expect(view.getByText(title)).toBeTruthy();
  });
});
