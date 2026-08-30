import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';

import { customizationStorageKey, loadCustomizationState } from '@/features/customization';

import CollectionScreen from '../collection';
import ProfileScreen from '../profile';
import TasksScreen from '../tasks';

const mockEquipItem = jest.fn();
const mockUnequipAccessorySlot = jest.fn();

async function waitForSelectedRoomMaterials(expected: readonly string[]): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await loadCustomizationState('profile-1');
    if (JSON.stringify(state.selectedRoomMaterials) === JSON.stringify(expected)) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Selected room materials were not persisted: ${expected.join(', ')}`);
}

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
      listCompletedSessions: () => Promise.resolve([]),
    }),
}));
jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-1',
          nickname: 'Ege',
          dateOfBirth: '2020-01-15',
          ageBand: '4_6',
          avatarId: 'inci',
          createdAt: '2026-08-09T00:00:00.000Z',
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

  it('marks calendar days before the profile creation date as neutral, not missed', async () => {
    const view = await render(<TasksScreen />);
    await waitFor(() => expect(view.getByTestId('tasks-calendar')).toBeTruthy());

    // Profile joined 2026-08-09 (see getActiveProfile mock). Step the calendar
    // back to July 2026 so every visible day predates the account.
    await fireEvent.press(view.getByLabelText('Önceki ay'));
    await waitFor(() => expect(view.getByTestId('tasks-day-2026-07-15')).toBeTruthy());

    await fireEvent.press(view.getByTestId('tasks-day-2026-07-15'));
    await waitFor(() =>
      expect(view.getAllByText('O tarihte henüz başlamamıştın').length).toBeGreaterThan(0),
    );
    // A pre-account day is never framed as a missed brushing.
    expect(view.queryByText('Bu seferlik kaçtı 😢')).toBeNull();
    expect(view.queryByText('Sorun değil, yarın tekrar deneyebiliriz!')).toBeNull();
  });

  it('renders themed room materials as independent collection preview objects', async () => {
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ selectedRoomMaterials: ['pastel-toy-box'], version: 1 }),
    );
    const view = await render(<CollectionScreen />);
    // Collection opens on the "Fırça" tab; switch to backgrounds for this scenario.
    await fireEvent.press(view.getByText('Arka Plan'));
    await waitFor(() => expect(view.getByText('Pastel Oyun Odası')).toBeTruthy());
    for (const slot of ['brush', 'background', 'decor', 'effect']) {
      const categoryIcon = view.getByTestId(`collection-category-icon-${slot}`);
      expect(StyleSheet.flatten(categoryIcon.props.style)).toMatchObject({ height: 48, width: 48 });
      expect(categoryIcon.props.resizeMode).toBe('contain');
    }
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
    expect(view.getByTestId('collection-item-visual-pastel-playroom')).toBeTruthy();
    await fireEvent.press(view.getByText('Oda'));
    await waitFor(() => expect(view.getByText('Oyuncak Kutusu')).toBeTruthy());
    expect(view.getByText('Yıldız Lamba')).toBeTruthy();
    expect(view.getByText('Renkli Minder')).toBeTruthy();
    expect(view.getByText('Minik Raf')).toBeTruthy();
    expect(view.getByText('Blok Küpleri')).toBeTruthy();
    await waitFor(() =>
      expect(view.getByTestId('collection-preview-room-material-pastel-toy-box')).toBeTruthy(),
    );
    // The "Oda" item list shows only room materials — no brush entry leaks in.
    // (Scoped to the item grid: "Fırça" is now also a permanent category tab label.)
    expect(within(view.getByTestId('collection-item-grid')).queryByText('Fırça')).toBeNull();
    await waitFor(() => expect(view.getByText('Seçimi kaldır')).toBeTruthy());
    expect(mockUnequipAccessorySlot).not.toHaveBeenCalled();
  });

  it('adds an unlocked room material on tap and removes it on a second tap', async () => {
    const view = await render(<CollectionScreen />);
    fireEvent.press(await view.findByText('Oda'));
    await waitFor(() => expect(view.getByText('Yıldız Lamba')).toBeTruthy());

    fireEvent(view.getByTestId('collection-preview-scene'), 'layout', {
      nativeEvent: { layout: { height: 386, width: 360, x: 0, y: 0 } },
    });
    expect(
      view.getByText('İstediğin öğeyi seç, ardından odanın içinde istediğin yere sürükle.'),
    ).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Yıldız Lamba. Kazanıldı' }));

    await waitFor(() =>
      expect(view.getByTestId('collection-preview-room-material-pastel-star-lamp')).toBeTruthy(),
    );
    await waitForSelectedRoomMaterials(['pastel-star-lamp']);
    await expect(loadCustomizationState('profile-1')).resolves.toMatchObject({
      placements: {
        'pastel-star-lamp': { scale: 0.8, x: 0.76, y: 0.72 },
      },
    });
    expect(view.queryByTestId('collection-drag-preview-pastel-star-lamp')).toBeNull();

    fireEvent.press(view.getByRole('button', { name: 'Yıldız Lamba. Seçili' }));

    await waitForSelectedRoomMaterials([]);
  });
});
