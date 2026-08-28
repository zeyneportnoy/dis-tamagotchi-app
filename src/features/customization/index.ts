export { RoomMaterialItem } from './RoomMaterialItem';
export {
  isRoomMaterialKey,
  isRoomMaterialUnlocked,
  isRoomThemeKey,
  roomMaterialCatalog,
  roomMaterialForKey,
  roomMaterialKeys,
  roomMaterialsForTheme,
  roomMaterialUnlockXp,
  roomThemeKeys,
} from './roomMaterials';
export type {
  RoomMaterial,
  RoomMaterialKey,
  RoomMaterialKind,
  RoomThemeKey,
} from './roomMaterials';
export {
  clampPlacement,
  customizationStorageKey,
  decodeCustomizationState,
  defaultPlacementForRoomMaterial,
  deleteCustomizationState,
  emptyCustomizationState,
  isCustomizationItemVisible,
  loadCustomizationState,
  placementAfterDrag,
  placementAfterBoundedDrag,
  presentCustomizationInventory,
  saveDeveloperEquippedItem,
  saveItemPlacement,
  saveSelectedRoomMaterials,
} from './state';
export type { CustomizationItemKey, CustomizationState, ItemPlacement, SceneSize } from './state';
