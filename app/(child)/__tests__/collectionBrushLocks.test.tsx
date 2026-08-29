import { cleanup, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { customizationStorageKey } from '@/features/customization';

import CollectionScreen from '../collection';

let mockMineScore = 0;
let mockBrushInventory: {
  key: string;
  slot: string;
  unlockXp: number;
  unlocked: boolean;
  equipped: boolean;
  unlockedAt: string | null;
  icon: string;
}[] = [];
const mockEquipItem = jest.fn(() => Promise.resolve());
const mockUnequipAccessorySlot = jest.fn(() => Promise.resolve());

const backgroundInventory = [
  {
    key: 'pastel-playroom',
    icon: '🏡',
    slot: 'background',
    unlockXp: 0,
    unlocked: true,
    equipped: true,
    unlockedAt: '2026-08-09T00:00:00.000Z',
  },
];

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
      listInventory: () => Promise.resolve([...mockBrushInventory, ...backgroundInventory]),
      equipItem: mockEquipItem,
      unequipAccessorySlot: mockUnequipAccessorySlot,
      getProgress: () => Promise.resolve({ totalXp: mockMineScore, level: 1 }),
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

const brushKeys = [
  ['classic-brush', 0],
  ['pink-brush', 80],
  ['star-brush', 240],
  ['mini-cape', 480],
  ['rainbow-brush', 920],
  ['dino-brush', 1520],
  ['space-brush', 2320],
  ['heart-brush', 3200],
] as const;

const buildBrushInventory = (equippedKey?: string) =>
  brushKeys.map(([key, unlockXp]) => ({
    key,
    slot: 'brush',
    unlockXp,
    // Simulate the legacy "unlocked forever" flag being set — the Collection
    // must still gate the card on the current Mine Puan balance.
    unlocked: true,
    equipped: key === equippedKey,
    unlockedAt: '2026-08-09T00:00:00.000Z',
    icon: '🪥',
  }));

describe('Collection · brush lock system', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockMineScore = 0;
    mockBrushInventory = buildBrushInventory();
  });

  afterEach(() => cleanup());

  type Rendered = Awaited<ReturnType<typeof render>>;
  const status = (view: Rendered, key: string): unknown =>
    view.getByTestId(`collection-item-status-${key}`).props.children;

  it('opens only the Bulut brush at 0 Mine Puan and shows targets on the rest', async () => {
    mockMineScore = 0;
    const view = await render(<CollectionScreen />);
    await waitFor(() => expect(view.getByTestId('collection-item-status-classic-brush')).toBeTruthy());

    expect(status(view, 'classic-brush')).toBe('Seçmek için dokun');
    expect(status(view, 'pink-brush')).toBe("80 Mine Puan'da açılır");
    expect(status(view, 'star-brush')).toBe("240 Mine Puan'da açılır");
    expect(status(view, 'heart-brush')).toBe("3200 Mine Puan'da açılır");
  });

  it('keeps the Yıldız brush locked at 239 Mine Puan', async () => {
    mockMineScore = 239;
    const view = await render(<CollectionScreen />);
    await waitFor(() => expect(view.getByTestId('collection-item-status-star-brush')).toBeTruthy());
    expect(status(view, 'star-brush')).toBe("240 Mine Puan'da açılır");
  });

  it('unlocks the Yıldız brush at exactly 240 Mine Puan and drops its target line', async () => {
    mockMineScore = 240;
    const view = await render(<CollectionScreen />);
    await waitFor(() => expect(view.getByTestId('collection-item-status-star-brush')).toBeTruthy());
    expect(status(view, 'star-brush')).toBe('Seçmek için dokun');
  });

  it('unlocks cumulatively at 920 Mine Puan', async () => {
    mockMineScore = 920;
    const view = await render(<CollectionScreen />);
    await waitFor(() =>
      expect(view.getByTestId('collection-item-status-rainbow-brush')).toBeTruthy(),
    );
    for (const key of ['classic-brush', 'pink-brush', 'star-brush', 'mini-cape', 'rainbow-brush']) {
      expect(status(view, key)).toBe('Seçmek için dokun');
    }
    expect(status(view, 'dino-brush')).toBe("1520 Mine Puan'da açılır");
    expect(status(view, 'space-brush')).toBe("2320 Mine Puan'da açılır");
    expect(status(view, 'heart-brush')).toBe("3200 Mine Puan'da açılır");
  });

  it('re-locks the equipped Yıldız brush after a -10 penalty drops the score to 230', async () => {
    // Star brush was chosen at 240; a missed slot dropped the balance to 230.
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ developerEquipped: { brush: 'star-brush' }, version: 1 }),
    );
    mockMineScore = 230;
    mockBrushInventory = buildBrushInventory('star-brush');

    const view = await render(<CollectionScreen />);
    await waitFor(() => expect(view.getByTestId('collection-item-status-star-brush')).toBeTruthy());

    // Yıldız is locked again and shows its target once more…
    expect(status(view, 'star-brush')).toBe("240 Mine Puan'da açılır");
    // …and the active brush fell back to Bulut.
    await waitFor(() => expect(status(view, 'classic-brush')).toBe('Seçili'));
    const persisted = JSON.parse(
      (await AsyncStorage.getItem(customizationStorageKey('profile-1'))) ?? '{}',
    );
    expect(persisted.developerEquipped.brush).toBe('classic-brush');
  });

  it('restores the Yıldız brush automatically once the score climbs back to 240', async () => {
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ developerEquipped: { brush: 'star-brush' }, version: 1 }),
    );
    mockMineScore = 240;
    mockBrushInventory = buildBrushInventory('star-brush');

    const view = await render(<CollectionScreen />);
    await waitFor(() => expect(view.getByTestId('collection-item-status-star-brush')).toBeTruthy());
    expect(status(view, 'star-brush')).toBe('Seçili');
    const persisted = JSON.parse(
      (await AsyncStorage.getItem(customizationStorageKey('profile-1'))) ?? '{}',
    );
    expect(persisted.developerEquipped.brush).toBe('star-brush');
  });
});
