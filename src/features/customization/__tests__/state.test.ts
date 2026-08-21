import AsyncStorage from '@react-native-async-storage/async-storage';

import type { InventoryItem } from '@/domain/rewards';

import {
  customizationStorageKey,
  decodeCustomizationState,
  loadCustomizationState,
  placementAfterDrag,
  presentCustomizationInventory,
  saveDeveloperEquippedItem,
  saveItemPlacement,
} from '../state';

const inventory: readonly InventoryItem[] = [
  {
    equipped: true,
    icon: '🏡',
    key: 'pastel-playroom',
    slot: 'background',
    unlocked: true,
    unlockedAt: '2026-08-21T00:00:00.000Z',
    unlockXp: 0,
  },
  {
    equipped: false,
    icon: '🌙',
    key: 'night-room',
    slot: 'background',
    unlocked: false,
    unlockedAt: null,
    unlockXp: 960,
  },
  {
    equipped: false,
    icon: '👓',
    key: 'star-glasses',
    slot: 'wearable',
    unlocked: false,
    unlockedAt: null,
    unlockXp: 200,
  },
];

describe('customization state', () => {
  beforeEach(async () => AsyncStorage.clear());

  it('persists placement per child without leaking it to another child', async () => {
    await saveItemPlacement('child-a', 'cozy-scarf', { scale: 1.2, x: 0.25, y: 0.75 });
    await saveItemPlacement('child-b', 'cozy-scarf', { scale: 0.8, x: 0.7, y: 0.3 });

    await expect(loadCustomizationState('child-a')).resolves.toMatchObject({
      placements: { 'cozy-scarf': { scale: 1.2, x: 0.25, y: 0.75 } },
    });
    await expect(loadCustomizationState('child-b')).resolves.toMatchObject({
      placements: { 'cozy-scarf': { scale: 0.8, x: 0.7, y: 0.3 } },
    });
  });

  it('converts drag distance to normalized scene placement and keeps it in bounds', () => {
    expect(
      placementAfterDrag(
        { scale: 1, x: 0.5, y: 0.5 },
        { x: 100, y: 80 },
        { height: 400, width: 500 },
      ),
    ).toEqual({ scale: 1, x: 0.7, y: 0.7 });
    expect(
      placementAfterDrag(
        { scale: 1, x: 0.9, y: 0.9 },
        { x: 500, y: 500 },
        { height: 400, width: 500 },
      ),
    ).toEqual({ scale: 1, x: 0.92, y: 0.92 });
  });

  it('unlocks and equips through a DEV-only view without changing production inventory', async () => {
    const state = await saveDeveloperEquippedItem('child-a', 'background', 'night-room');
    const developerItems = presentCustomizationInventory(inventory, state, true);
    const productionItems = presentCustomizationInventory(inventory, state, false);

    expect(developerItems.find((item) => item.key === 'night-room')).toMatchObject({
      equipped: true,
      unlocked: true,
    });
    expect(productionItems.find((item) => item.key === 'night-room')).toMatchObject({
      equipped: false,
      unlocked: false,
    });
    expect(inventory[1]).toMatchObject({ equipped: false, unlocked: false });
  });

  it('hides glasses and masks while preserving their catalog data', () => {
    expect(presentCustomizationInventory(inventory, decodeCustomizationState(null), true)).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ key: 'star-glasses' })]),
    );
    expect(inventory).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'star-glasses' })]),
    );
  });

  it('upgrades an unversioned payload and safely ignores a future schema version', async () => {
    await AsyncStorage.setItem(
      customizationStorageKey('legacy-child'),
      JSON.stringify({ placements: { 'mini-hat': { scale: 1, x: 0.3, y: 0.2 } } }),
    );
    await expect(loadCustomizationState('legacy-child')).resolves.toMatchObject({
      placements: { 'mini-hat': { scale: 1, x: 0.3, y: 0.2 } },
      version: 1,
    });
    expect(decodeCustomizationState(JSON.stringify({ version: 2 }))).toMatchObject({
      developerEquipped: {},
      placements: {},
      version: 1,
    });
  });
});
