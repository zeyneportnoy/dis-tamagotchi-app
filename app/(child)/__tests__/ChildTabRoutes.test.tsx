import { fireEvent, render, waitFor } from '@testing-library/react-native';

import CollectionScreen from '../collection';
import ProfileScreen from '../profile';
import TasksScreen from '../tasks';

const mockEquipItem = jest.fn();
const mockUnequipAccessorySlot = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/application/child', () => ({
  getChildExperienceUseCases: () =>
    Promise.resolve({
      listInventory: () =>
        Promise.resolve([
          {
            key: 'pastel-playroom',
            icon: '🏡',
            slot: 'background',
            unlockXp: 0,
            unlocked: true,
            equipped: true,
            unlockedAt: '2026-08-09T00:00:00.000Z',
          },
          {
            key: 'cozy-scarf',
            icon: '☁️',
            slot: 'decor',
            unlockXp: 0,
            unlocked: true,
            equipped: true,
            unlockedAt: '2026-08-09T00:00:00.000Z',
          },
          {
            key: 'sparkle-crown',
            icon: '👑',
            slot: 'wearable',
            unlockXp: 40,
            unlocked: true,
            equipped: true,
            unlockedAt: '2026-08-09T01:00:00.000Z',
          },
          {
            key: 'star-crown',
            icon: '⭐',
            slot: 'wearable',
            unlockXp: 80,
            unlocked: false,
            equipped: false,
            unlockedAt: null,
          },
          {
            key: 'mini-hat',
            icon: '🎩',
            slot: 'wearable',
            unlockXp: 160,
            unlocked: true,
            equipped: false,
            unlockedAt: '2026-08-09T02:00:00.000Z',
          },
        ]),
      equipItem: mockEquipItem,
      unequipAccessorySlot: mockUnequipAccessorySlot,
      getProgress: () => Promise.resolve({ level: 2 }),
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

describe('Child tab routes', () => {
  it.each([
    [TasksScreen, 'tasks-screen', 'Görevler'],
    [CollectionScreen, 'collection-screen', 'Koleksiyonum'],
    [ProfileScreen, 'profile-screen', 'Profil'],
  ])('renders a real placeholder route', async (Route, testID, title) => {
    const view = await render(<Route />);
    await waitFor(() => expect(view.getByTestId(testID)).toBeTruthy());
    expect(view.getByText(title)).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Geri' })).toBeNull();
  });

  it('equips an unlocked item and gently rejects a locked item', async () => {
    const view = await render(<CollectionScreen />);
    await fireEvent.press(view.getByText('Aksesuar'));
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Mini Taç. Seçili' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Yıldız Saç Bandı. Henüz kilitli 🔒' }));
    expect(mockEquipItem).not.toHaveBeenCalled();
    await waitFor(() => expect(view.getByText('Henüz kilitli 🔒')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Mini Taç. Seçili' }));
    await waitFor(() =>
      expect(mockUnequipAccessorySlot).toHaveBeenCalledWith('profile-1', 'wearable'),
    );
    await waitFor(() => expect(view.queryByText('Seçimi kaldır')).toBeNull());
    await fireEvent.press(view.getByRole('button', { name: 'Uyku Şapkası. Kazanıldı' }));
    await waitFor(() => expect(mockEquipItem).toHaveBeenCalledWith('profile-1', 'mini-hat'));
  });

  it('hides brush rewards and removes a selected background immediately', async () => {
    const view = await render(<CollectionScreen />);
    await waitFor(() => expect(view.getByText('Pastel Oyun Odası')).toBeTruthy());
    expect(view.queryByText('Fırça')).toBeNull();
    await fireEvent.press(view.getByText('Seçimi kaldır'));
    await waitFor(() =>
      expect(mockUnequipAccessorySlot).toHaveBeenCalledWith('profile-1', 'background'),
    );
    expect(view.queryByText('Seçimi kaldır')).toBeNull();
  });
});
