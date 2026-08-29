import {
  isRoomMaterialUnlocked,
  roomMaterialCatalog,
  roomMaterialForKey,
  roomMaterialsForTheme,
  roomThemeKeys,
} from '../roomMaterials';

const themeThresholds = [
  ['pastel-playroom', 0],
  ['cloud-room', 160],
  ['rainbow-room', 640],
  ['space-room', 1280],
  ['undersea-room', 2200],
  ['rainbow-cape', 3600],
] as const;

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

  it('unlocks every material together with its matching background for all themes', () => {
    for (const [themeKey, threshold] of themeThresholds) {
      const materials = roomMaterialsForTheme(themeKey);
      expect(materials.every((item) => isRoomMaterialUnlocked(item, threshold))).toBe(true);
      if (threshold > 0) {
        expect(materials.every((item) => !isRoomMaterialUnlocked(item, threshold - 1))).toBe(true);
      }
    }
  });

  it('uses the current score so matching room materials re-lock with their background', () => {
    const material = roomMaterialForKey('rainbow-rug');
    expect(isRoomMaterialUnlocked(material, 640)).toBe(true);
    expect(isRoomMaterialUnlocked(material, 630)).toBe(false);
  });
});
