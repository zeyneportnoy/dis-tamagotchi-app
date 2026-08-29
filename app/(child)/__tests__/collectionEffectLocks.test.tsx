import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { customizationStorageKey } from '@/features/customization';

import CollectionScreen from '../collection';

let mockMineScore = 0;
let mockEffectInventory: {
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
      listInventory: () => Promise.resolve([...mockEffectInventory]),
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

const effectKeys = [
  ['rainbow-light', 0],
  ['gold-sparkle', 80],
  ['star-sparkle', 240],
  ['confetti-glow', 600],
  ['magic-dust', 1200],
  ['cloud-effect', 2000],
] as const;

const buildEffectInventory = (equippedKey = 'rainbow-light') =>
  effectKeys.map(([key, unlockXp]) => ({
    key,
    slot: 'effect',
    unlockXp,
    // Simulate the legacy "unlocked forever" flag being set — the Collection
    // must still gate the card on the current Mine Puan balance.
    unlocked: true,
    equipped: key === equippedKey,
    unlockedAt: '2026-08-09T00:00:00.000Z',
    icon: '✦',
  }));

type Rendered = Awaited<ReturnType<typeof render>>;

const openEffectTab = async (view: Rendered) => {
  await waitFor(() => expect(view.getByText('Efekt')).toBeTruthy());
  fireEvent.press(view.getByText('Efekt'));
  await waitFor(() =>
    expect(view.getByTestId('collection-item-status-rainbow-light')).toBeTruthy(),
  );
};

const status = (view: Rendered, key: string): unknown =>
  view.getByTestId(`collection-item-status-${key}`).props.children;

describe('Collection · effect lock system', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockMineScore = 0;
    mockEffectInventory = buildEffectInventory();
  });

  afterEach(() => cleanup());

  it('opens only Gökkuşağı Parıltısı at 0 Mine Puan and shows targets on the rest', async () => {
    mockMineScore = 0;
    const view = await render(<CollectionScreen />);
    await openEffectTab(view);

    expect(status(view, 'rainbow-light')).toBe('Seçili');
    expect(status(view, 'gold-sparkle')).toBe("80 Mine Puan'da açılır");
    expect(status(view, 'star-sparkle')).toBe("240 Mine Puan'da açılır");
    expect(status(view, 'cloud-effect')).toBe("2000 Mine Puan'da açılır");
  });

  it('keeps Minik Işıklar locked at 239 Mine Puan', async () => {
    mockMineScore = 239;
    const view = await render(<CollectionScreen />);
    await openEffectTab(view);
    expect(status(view, 'star-sparkle')).toBe("240 Mine Puan'da açılır");
  });

  it('unlocks Minik Işıklar at exactly 240 and drops its target line', async () => {
    mockMineScore = 240;
    const view = await render(<CollectionScreen />);
    await openEffectTab(view);
    expect(status(view, 'star-sparkle')).toBe('Seçmek için dokun');
  });

  it('unlocks cumulatively at 600 Mine Puan', async () => {
    mockMineScore = 600;
    const view = await render(<CollectionScreen />);
    await openEffectTab(view);
    expect(status(view, 'rainbow-light')).toBe('Seçili');
    for (const key of ['gold-sparkle', 'star-sparkle', 'confetti-glow']) {
      expect(status(view, key)).toBe('Seçmek için dokun');
    }
    expect(status(view, 'magic-dust')).toBe("1200 Mine Puan'da açılır");
    expect(status(view, 'cloud-effect')).toBe("2000 Mine Puan'da açılır");
  });

  it('re-locks the equipped Minik Işıklar after a -10 penalty drops the score to 230', async () => {
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ developerEquipped: { effect: 'star-sparkle' }, version: 1 }),
    );
    mockMineScore = 230;
    mockEffectInventory = buildEffectInventory('star-sparkle');

    const view = await render(<CollectionScreen />);
    await openEffectTab(view);

    expect(status(view, 'star-sparkle')).toBe("240 Mine Puan'da açılır");
    await waitFor(() => expect(status(view, 'rainbow-light')).toBe('Seçili'));
    const persisted = JSON.parse(
      (await AsyncStorage.getItem(customizationStorageKey('profile-1'))) ?? '{}',
    );
    expect(persisted.developerEquipped.effect).toBe('rainbow-light');
  });

  it('restores Minik Işıklar automatically once the score climbs back to 240', async () => {
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ developerEquipped: { effect: 'star-sparkle' }, version: 1 }),
    );
    mockMineScore = 240;
    mockEffectInventory = buildEffectInventory('star-sparkle');

    const view = await render(<CollectionScreen />);
    await openEffectTab(view);
    expect(status(view, 'star-sparkle')).toBe('Seçili');
    const persisted = JSON.parse(
      (await AsyncStorage.getItem(customizationStorageKey('profile-1'))) ?? '{}',
    );
    expect(persisted.developerEquipped.effect).toBe('star-sparkle');
  });
});
