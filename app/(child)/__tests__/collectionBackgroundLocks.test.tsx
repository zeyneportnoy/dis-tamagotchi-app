import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { customizationStorageKey } from '@/features/customization';

import CollectionScreen from '../collection';

let mockMineScore = 0;
let mockBackgroundInventory: {
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
      listInventory: () => Promise.resolve([...mockBackgroundInventory]),
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

const backgroundKeys = [
  ['pastel-playroom', 0],
  ['cloud-room', 160],
  ['rainbow-room', 640],
  ['space-room', 1280],
  ['undersea-room', 2200],
  ['rainbow-cape', 3600],
] as const;

const buildBackgroundInventory = (equippedKey = 'pastel-playroom') =>
  backgroundKeys.map(([key, unlockXp]) => ({
    key,
    slot: 'background',
    unlockXp,
    // Simulate the legacy "unlocked forever" flag being set — the Collection
    // must still gate the card on the current Mine Puan balance.
    unlocked: true,
    equipped: key === equippedKey,
    unlockedAt: '2026-08-09T00:00:00.000Z',
    icon: '🏡',
  }));

type Rendered = Awaited<ReturnType<typeof render>>;

const openBackgroundTab = async (view: Rendered) => {
  await waitFor(() => expect(view.getByText('Arka Plan')).toBeTruthy());
  fireEvent.press(view.getByText('Arka Plan'));
  await waitFor(() =>
    expect(view.getByTestId('collection-item-status-pastel-playroom')).toBeTruthy(),
  );
};

const status = (view: Rendered, key: string): unknown =>
  view.getByTestId(`collection-item-status-${key}`).props.children;

describe('Collection · background lock system', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockMineScore = 0;
    mockBackgroundInventory = buildBackgroundInventory();
  });

  afterEach(() => cleanup());

  it('opens only Pastel Oyun Odası at 0 Mine Puan and shows targets on the rest', async () => {
    mockMineScore = 0;
    const view = await render(<CollectionScreen />);
    await openBackgroundTab(view);

    expect(status(view, 'pastel-playroom')).toBe('Seçili');
    expect(status(view, 'cloud-room')).toBe("160 Mine Puan'da açılır");
    expect(status(view, 'rainbow-room')).toBe("640 Mine Puan'da açılır");
    expect(status(view, 'rainbow-cape')).toBe("3600 Mine Puan'da açılır");
  });

  it('keeps Gökkuşağı Işıltısı locked at 639 Mine Puan', async () => {
    mockMineScore = 639;
    const view = await render(<CollectionScreen />);
    await openBackgroundTab(view);
    expect(status(view, 'rainbow-room')).toBe("640 Mine Puan'da açılır");
  });

  it('unlocks Gökkuşağı Işıltısı at exactly 640 and drops its target line', async () => {
    mockMineScore = 640;
    const view = await render(<CollectionScreen />);
    await openBackgroundTab(view);
    expect(status(view, 'rainbow-room')).toBe('Seçmek için dokun');
  });

  it('unlocks cumulatively at 1280 Mine Puan', async () => {
    mockMineScore = 1280;
    const view = await render(<CollectionScreen />);
    await openBackgroundTab(view);
    expect(status(view, 'pastel-playroom')).toBe('Seçili');
    for (const key of ['cloud-room', 'rainbow-room', 'space-room']) {
      expect(status(view, key)).toBe('Seçmek için dokun');
    }
    expect(status(view, 'undersea-room')).toBe("2200 Mine Puan'da açılır");
    expect(status(view, 'rainbow-cape')).toBe("3600 Mine Puan'da açılır");
  });

  it('re-locks the equipped Gökkuşağı Işıltısı after a -10 penalty drops the score to 630', async () => {
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ developerEquipped: { background: 'rainbow-room' }, version: 1 }),
    );
    mockMineScore = 630;
    mockBackgroundInventory = buildBackgroundInventory('rainbow-room');

    const view = await render(<CollectionScreen />);
    await openBackgroundTab(view);

    expect(status(view, 'rainbow-room')).toBe("640 Mine Puan'da açılır");
    await waitFor(() => expect(status(view, 'pastel-playroom')).toBe('Seçili'));
    const persisted = JSON.parse(
      (await AsyncStorage.getItem(customizationStorageKey('profile-1'))) ?? '{}',
    );
    expect(persisted.developerEquipped.background).toBe('pastel-playroom');
  });

  it('restores Gökkuşağı Işıltısı automatically once the score climbs back to 640', async () => {
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ developerEquipped: { background: 'rainbow-room' }, version: 1 }),
    );
    mockMineScore = 640;
    mockBackgroundInventory = buildBackgroundInventory('rainbow-room');

    const view = await render(<CollectionScreen />);
    await openBackgroundTab(view);
    expect(status(view, 'rainbow-room')).toBe('Seçili');
    const persisted = JSON.parse(
      (await AsyncStorage.getItem(customizationStorageKey('profile-1'))) ?? '{}',
    );
    expect(persisted.developerEquipped.background).toBe('rainbow-room');
  });
});
