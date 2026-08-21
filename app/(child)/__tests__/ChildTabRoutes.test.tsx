import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';

import CollectionScreen from '../collection';
import ProfileScreen from '../profile';
import TasksScreen from '../tasks';

const mockEquipItem = jest.fn();
const mockUnequipAccessorySlot = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(() => callback(), [callback]),
  };
});
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
          ...[
            'cloud-room',
            'rainbow-room',
            'space-room',
            'undersea-room',
            'rainbow-cape',
            'night-room',
            'forest-room',
          ].map((key, index) => ({
            equipped: false,
            icon: '🌄',
            key,
            slot: 'background' as const,
            unlocked: true,
            unlockedAt: '2026-08-09T00:00:00.000Z',
            unlockXp: 100 + index * 100,
          })),
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
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

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

  it('makes every supported item selectable in DEV without writing production inventory', async () => {
    const view = await render(<CollectionScreen />);
    await fireEvent.press(view.getByText('Aksesuar'));
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Mini Taç. Seçili' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Yıldız Saç Bandı. Kazanıldı' }));
    expect(mockEquipItem).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Yıldız Saç Bandı. Seçili' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Uyku Şapkası. Kazanıldı' }));
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Uyku Şapkası. Seçili' })).toBeTruthy(),
    );
    expect(mockEquipItem).not.toHaveBeenCalled();
    expect(mockUnequipAccessorySlot).not.toHaveBeenCalled();
  });

  it('hides brush rewards and removes a selected background immediately', async () => {
    const view = await render(<CollectionScreen />);
    await waitFor(() => expect(view.getByText('Pastel Oyun Odası')).toBeTruthy());
    expect(view.getByText('Şeker Bulutlar')).toBeTruthy();
    expect(view.getByText('Gökkuşağı Işıltısı')).toBeTruthy();
    expect(view.getByText('Gece Işıltısı')).toBeTruthy();
    expect(view.getByText('Deniz Altı Odası')).toBeTruthy();
    expect(view.getByText('Gün Batımı Odası')).toBeTruthy();
    expect(view.queryByText('Yıldızlı Uyku Odası')).toBeNull();
    expect(view.queryByText('Orman Odası')).toBeNull();
    fireEvent(view.getByTestId('collection-preview-scene'), 'layout', {
      nativeEvent: { layout: { height: 386, width: 360, x: 0, y: 0 } },
    });
    expect(
      StyleSheet.flatten(view.getByTestId('collection-preview-background').props.style),
    ).toMatchObject({
      bottom: 0,
      height: '100%',
      left: 0,
      opacity: 1,
      position: 'absolute',
      right: 0,
      top: 0,
      width: '100%',
    });
    await waitFor(() => expect(view.getByTestId('collection-preview-decor')).toBeTruthy());
    expect(view.getByTestId('collection-item-visual-pastel-playroom')).toBeTruthy();
    expect(view.queryByText('Fırça')).toBeNull();
    await fireEvent.press(view.getByText('Seçimi kaldır'));
    expect(mockUnequipAccessorySlot).not.toHaveBeenCalled();
    expect(view.queryByText('Seçimi kaldır')).toBeNull();
  });
});
