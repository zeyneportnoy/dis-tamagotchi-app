import type { InventoryItem } from '@/domain/rewards';

import {
  isRoomMaterialUnlocked,
  roomMaterialCatalog,
  roomMaterialForKey,
  roomMaterialsForTheme,
  roomThemeKeys,
} from '../roomMaterials';

describe('room material catalog', () => {
  it('provides five distinct transparent scene assets for each of the six supported themes', () => {
    expect(roomMaterialCatalog).toHaveLength(30);
    expect(new Set(roomMaterialCatalog.map((item) => item.key)).size).toBe(30);

    for (const themeKey of roomThemeKeys) {
      const materials = roomMaterialsForTheme(themeKey);
      expect(materials).toHaveLength(5);
      expect(materials.every((item) => item.source !== undefined)).toBe(true);
    }
  });

  it('unlocks every room material only in DEV while production follows existing rewards', () => {
    const material = roomMaterialForKey('pastel-blocks');
    const lockedInventory: readonly InventoryItem[] = [
      {
        equipped: false,
        icon: '🪴',
        key: material.unlockItemKey,
        slot: 'decor',
        unlocked: false,
        unlockedAt: null,
        unlockXp: 440,
      },
    ];

    expect(isRoomMaterialUnlocked(material, lockedInventory, true)).toBe(true);
    expect(isRoomMaterialUnlocked(material, lockedInventory, false)).toBe(false);
    expect(
      isRoomMaterialUnlocked(material, [{ ...lockedInventory[0]!, unlocked: true }], false),
    ).toBe(true);
  });
});
