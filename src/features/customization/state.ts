import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  rewardCatalog,
  rewardItemForKey,
  type AccessorySlot,
  type InventoryItem,
  type RewardItemKey,
} from '@/domain/rewards';

import {
  isRoomMaterialKey,
  roomMaterialForKey,
  roomMaterialKeys,
  type RoomMaterialKey,
} from './roomMaterials';

export type SceneSize = Readonly<{ height: number; width: number }>;
export type ItemPlacement = Readonly<{ scale: number; x: number; y: number }>;
export type CustomizationItemKey = RewardItemKey | RoomMaterialKey;
export type CustomizationState = Readonly<{
  developerEquipped: Partial<Record<AccessorySlot, RewardItemKey | null>>;
  placements: Partial<Record<CustomizationItemKey, ItemPlacement>>;
  selectedRoomMaterials: readonly RoomMaterialKey[];
  version: 1;
}>;

type StoredCustomizationState = Readonly<{
  developerEquipped?: Partial<Record<AccessorySlot, RewardItemKey | null>>;
  placements?: Partial<Record<CustomizationItemKey, ItemPlacement>>;
  selectedRoomMaterials?: readonly string[];
  version?: number;
}>;

const hiddenWearableKeys = new Set<RewardItemKey>([
  'star-glasses',
  'super-glasses',
  'color-glasses',
]);
const rewardKeys = new Set<string>(rewardCatalog.map((item) => item.key));
const customizationItemKeys = new Set<string>([...rewardKeys, ...roomMaterialKeys]);
const slots = new Set<AccessorySlot>(['background', 'decor', 'effect', 'wearable', 'brush']);
const updateQueues = new Map<string, Promise<CustomizationState>>();

export const emptyCustomizationState: CustomizationState = {
  developerEquipped: {},
  placements: {},
  selectedRoomMaterials: [],
  version: 1,
};

export const customizationStorageKey = (profileId: string): string =>
  `customization.profile.${profileId}.v1`;

const finiteInRange = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

export function clampPlacement(placement: ItemPlacement): ItemPlacement {
  return {
    scale: Math.max(0.55, Math.min(1.6, placement.scale)),
    x: Math.max(0.08, Math.min(0.92, placement.x)),
    y: Math.max(0.08, Math.min(0.92, placement.y)),
  };
}

export function placementAfterDrag(
  start: ItemPlacement,
  delta: Readonly<{ x: number; y: number }>,
  sceneSize: SceneSize,
): ItemPlacement {
  if (sceneSize.width <= 0 || sceneSize.height <= 0) return start;
  return clampPlacement({
    ...start,
    x: start.x + delta.x / sceneSize.width,
    y: start.y + delta.y / sceneSize.height,
  });
}

export function placementAfterBoundedDrag(
  start: ItemPlacement,
  delta: Readonly<{ x: number; y: number }>,
  sceneSize: SceneSize,
  itemSize: Readonly<{ height: number; width: number }>,
): ItemPlacement {
  if (sceneSize.width <= 0 || sceneSize.height <= 0) return start;
  const proposed = clampPlacement({
    ...start,
    x: start.x + delta.x / sceneSize.width,
    y: start.y + delta.y / sceneSize.height,
  });
  const halfWidth = Math.min(0.49, (itemSize.width * proposed.scale) / sceneSize.width / 2);
  const halfHeight = Math.min(0.49, (itemSize.height * proposed.scale) / sceneSize.height / 2);
  return {
    ...proposed,
    x: Math.max(halfWidth, Math.min(1 - halfWidth, proposed.x)),
    y: Math.max(halfHeight, Math.min(1 - halfHeight, proposed.y)),
  };
}

function decodePlacement(value: unknown): ItemPlacement | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ItemPlacement>;
  if (
    !finiteInRange(candidate.x, -1, 2) ||
    !finiteInRange(candidate.y, -1, 2) ||
    !finiteInRange(candidate.scale, 0.1, 4)
  ) {
    return null;
  }
  return clampPlacement(candidate as ItemPlacement);
}

export function decodeCustomizationState(raw: string | null): CustomizationState {
  if (!raw) return emptyCustomizationState;
  try {
    const parsed = JSON.parse(raw) as StoredCustomizationState;
    if (parsed.version !== undefined && parsed.version !== 1) return emptyCustomizationState;

    const placements: Partial<Record<CustomizationItemKey, ItemPlacement>> = {};
    for (const [key, value] of Object.entries(parsed.placements ?? {})) {
      if (!customizationItemKeys.has(key)) continue;
      const placement = decodePlacement(value);
      if (placement) placements[key as CustomizationItemKey] = placement;
    }

    const selectedRoomMaterials = Array.from(
      new Set(
        (parsed.selectedRoomMaterials ?? []).filter(
          (key): key is RoomMaterialKey => typeof key === 'string' && isRoomMaterialKey(key),
        ),
      ),
    );

    const developerEquipped: Partial<Record<AccessorySlot, RewardItemKey | null>> = {};
    for (const [slot, key] of Object.entries(parsed.developerEquipped ?? {})) {
      if (!slots.has(slot as AccessorySlot)) continue;
      if (key === null) {
        developerEquipped[slot as AccessorySlot] = null;
      } else if (typeof key === 'string' && rewardKeys.has(key)) {
        const itemKey = key as RewardItemKey;
        if (rewardItemForKey(itemKey).slot === slot) {
          developerEquipped[slot as AccessorySlot] = itemKey;
        }
      }
    }

    return { developerEquipped, placements, selectedRoomMaterials, version: 1 };
  } catch {
    return emptyCustomizationState;
  }
}

export async function loadCustomizationState(profileId: string): Promise<CustomizationState> {
  return decodeCustomizationState(await AsyncStorage.getItem(customizationStorageKey(profileId)));
}

async function updateCustomizationState(
  profileId: string,
  update: (current: CustomizationState) => CustomizationState,
): Promise<CustomizationState> {
  const previous =
    updateQueues.get(profileId) ??
    loadCustomizationState(profileId).catch(() => emptyCustomizationState);
  const pending = previous.then(async (current) => {
    const next = update(current);
    await AsyncStorage.setItem(customizationStorageKey(profileId), JSON.stringify(next));
    return next;
  });
  updateQueues.set(profileId, pending);
  try {
    return await pending;
  } finally {
    if (updateQueues.get(profileId) === pending) updateQueues.delete(profileId);
  }
}

export function saveItemPlacement(
  profileId: string,
  itemKey: CustomizationItemKey,
  placement: ItemPlacement,
): Promise<CustomizationState> {
  return updateCustomizationState(profileId, (current) => ({
    ...current,
    placements: { ...current.placements, [itemKey]: clampPlacement(placement) },
  }));
}

export function saveSelectedRoomMaterials(
  profileId: string,
  itemKeys: readonly RoomMaterialKey[],
): Promise<CustomizationState> {
  const uniqueKeys = Array.from(new Set(itemKeys)).filter(isRoomMaterialKey);
  return updateCustomizationState(profileId, (current) => ({
    ...current,
    selectedRoomMaterials: uniqueKeys,
  }));
}

export function saveDeveloperEquippedItem(
  profileId: string,
  slot: AccessorySlot,
  itemKey: RewardItemKey | null,
): Promise<CustomizationState> {
  return updateCustomizationState(profileId, (current) => ({
    ...current,
    developerEquipped: { ...current.developerEquipped, [slot]: itemKey },
  }));
}

export function isCustomizationItemVisible(item: InventoryItem): boolean {
  return !hiddenWearableKeys.has(item.key);
}

export function presentCustomizationInventory(
  inventory: readonly InventoryItem[],
  state: CustomizationState,
  developerMode: boolean,
): readonly InventoryItem[] {
  return inventory.filter(isCustomizationItemVisible).map((item) => {
    if (!developerMode) return item;
    const hasOverride = Object.prototype.hasOwnProperty.call(state.developerEquipped, item.slot);
    const override = state.developerEquipped[item.slot];
    return {
      ...item,
      unlocked: true,
      equipped: hasOverride ? override === item.key : item.equipped,
    };
  });
}

export function defaultPlacementFor(itemKey: RewardItemKey): ItemPlacement {
  const item = rewardItemForKey(itemKey);
  if (item.slot === 'wearable') return { scale: 0.88, x: 0.18, y: 0.2 };
  if (itemKey === 'cozy-scarf') return { scale: 1.18, x: 0.5, y: 0.84 };
  if (itemKey === 'heart-rug' || itemKey === 'color-pillow') {
    return { scale: 1.2, x: 0.5, y: 0.85 };
  }
  if (itemKey === 'heart-badge' || itemKey === 'moon-lamp') {
    return { scale: 0.82, x: 0.78, y: 0.28 };
  }
  if (itemKey === 'mini-shelf') return { scale: 0.9, x: 0.78, y: 0.72 };
  return { scale: 0.9, x: 0.2, y: 0.74 };
}

export function defaultPlacementForRoomMaterial(itemKey: RoomMaterialKey): ItemPlacement {
  return roomMaterialForKey(itemKey).defaultPlacement;
}
