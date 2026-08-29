import type { ImageSourcePropType } from 'react-native';

import { isBackgroundUnlockedForScore, type RewardItemKey } from '@/domain/rewards';

export const roomThemeKeys = [
  'pastel-playroom',
  'cloud-room',
  'rainbow-room',
  'space-room',
  'undersea-room',
  'rainbow-cape',
] as const satisfies readonly RewardItemKey[];

export type RoomThemeKey = (typeof roomThemeKeys)[number];

export const roomMaterialKeys = [
  'pastel-toy-box',
  'pastel-star-lamp',
  'pastel-color-cushion',
  'pastel-mini-shelf',
  'pastel-blocks',
  'cloud-cloud-cushion',
  'cloud-candy-pillow',
  'cloud-mini-moon-lamp',
  'cloud-star-hanger',
  'cloud-cotton-decor',
  'rainbow-rug',
  'rainbow-color-pillow',
  'rainbow-sparkle-lamp',
  'rainbow-star-cushion',
  'rainbow-decor-stand',
  'night-moon-lamp',
  'night-star-lamp',
  'night-sleep-cushion',
  'night-pillow',
  'night-mini-decor',
  'undersea-coral-cushion',
  'undersea-shell-pouf',
  'undersea-pearl-lamp',
  'undersea-starfish-decor',
  'undersea-bubble-decor',
  'sunset-cushion',
  'sunset-sun-decor',
  'sunset-leaf-pillow',
  'sunset-small-plant',
  'sunset-mini-shelf',
] as const;

export type RoomMaterialKey = (typeof roomMaterialKeys)[number];
export type RoomMaterialKind = 'floor' | 'lamp' | 'soft' | 'stand';

export type RoomMaterial = Readonly<{
  backgroundKey: RoomThemeKey;
  defaultPlacement: Readonly<{ scale: number; x: number; y: number }>;
  dimensions: Readonly<{ height: number; width: number }>;
  key: RoomMaterialKey;
  kind: RoomMaterialKind;
  source: ImageSourcePropType;
}>;

const defaults = [
  {
    defaultPlacement: { scale: 0.88, x: 0.25, y: 0.78 },
    dimensions: { height: 104, width: 118 },
    kind: 'floor',
  },
  {
    defaultPlacement: { scale: 0.8, x: 0.76, y: 0.72 },
    dimensions: { height: 108, width: 104 },
    kind: 'soft',
  },
  {
    defaultPlacement: { scale: 0.72, x: 0.2, y: 0.36 },
    dimensions: { height: 112, width: 96 },
    kind: 'lamp',
  },
  {
    defaultPlacement: { scale: 0.68, x: 0.8, y: 0.35 },
    dimensions: { height: 116, width: 102 },
    kind: 'stand',
  },
  {
    defaultPlacement: { scale: 0.66, x: 0.77, y: 0.84 },
    dimensions: { height: 94, width: 108 },
    kind: 'floor',
  },
] as const satisfies readonly Pick<RoomMaterial, 'defaultPlacement' | 'dimensions' | 'kind'>[];

function material(
  key: RoomMaterialKey,
  backgroundKey: RoomThemeKey,
  index: 0 | 1 | 2 | 3 | 4,
  source: ImageSourcePropType,
): RoomMaterial {
  return { ...defaults[index], backgroundKey, key, source };
}

export const roomMaterialCatalog = [
  material(
    'pastel-toy-box',
    'pastel-playroom',
    0,
    require('../../../assets/rewards/room-materials/pastel-toy-box.png'),
  ),
  material(
    'pastel-star-lamp',
    'pastel-playroom',
    1,
    require('../../../assets/rewards/room-materials/pastel-star-lamp.png'),
  ),
  material(
    'pastel-color-cushion',
    'pastel-playroom',
    2,
    require('../../../assets/rewards/room-materials/pastel-color-cushion.png'),
  ),
  material(
    'pastel-mini-shelf',
    'pastel-playroom',
    3,
    require('../../../assets/rewards/room-materials/pastel-mini-shelf.png'),
  ),
  material(
    'pastel-blocks',
    'pastel-playroom',
    4,
    require('../../../assets/rewards/room-materials/pastel-blocks.png'),
  ),
  material(
    'cloud-cloud-cushion',
    'cloud-room',
    0,
    require('../../../assets/rewards/room-materials/cloud-cloud-cushion.png'),
  ),
  material(
    'cloud-candy-pillow',
    'cloud-room',
    1,
    require('../../../assets/rewards/room-materials/cloud-candy-pillow.png'),
  ),
  material(
    'cloud-mini-moon-lamp',
    'cloud-room',
    2,
    require('../../../assets/rewards/room-materials/cloud-mini-moon-lamp.png'),
  ),
  material(
    'cloud-star-hanger',
    'cloud-room',
    3,
    require('../../../assets/rewards/room-materials/cloud-star-hanger.png'),
  ),
  material(
    'cloud-cotton-decor',
    'cloud-room',
    4,
    require('../../../assets/rewards/room-materials/cloud-cotton-decor.png'),
  ),
  material(
    'rainbow-rug',
    'rainbow-room',
    0,
    require('../../../assets/rewards/room-materials/rainbow-rug.png'),
  ),
  material(
    'rainbow-color-pillow',
    'rainbow-room',
    1,
    require('../../../assets/rewards/room-materials/rainbow-color-pillow.png'),
  ),
  material(
    'rainbow-sparkle-lamp',
    'rainbow-room',
    2,
    require('../../../assets/rewards/room-materials/rainbow-sparkle-lamp.png'),
  ),
  material(
    'rainbow-star-cushion',
    'rainbow-room',
    3,
    require('../../../assets/rewards/room-materials/rainbow-star-cushion.png'),
  ),
  material(
    'rainbow-decor-stand',
    'rainbow-room',
    4,
    require('../../../assets/rewards/room-materials/rainbow-decor-stand.png'),
  ),
  material(
    'night-moon-lamp',
    'space-room',
    0,
    require('../../../assets/rewards/room-materials/night-moon-lamp.png'),
  ),
  material(
    'night-star-lamp',
    'space-room',
    1,
    require('../../../assets/rewards/room-materials/night-star-lamp.png'),
  ),
  material(
    'night-sleep-cushion',
    'space-room',
    2,
    require('../../../assets/rewards/room-materials/night-sleep-cushion.png'),
  ),
  material(
    'night-pillow',
    'space-room',
    3,
    require('../../../assets/rewards/room-materials/night-pillow.png'),
  ),
  material(
    'night-mini-decor',
    'space-room',
    4,
    require('../../../assets/rewards/room-materials/night-mini-decor.png'),
  ),
  material(
    'undersea-coral-cushion',
    'undersea-room',
    0,
    require('../../../assets/rewards/room-materials/undersea-coral-cushion.png'),
  ),
  material(
    'undersea-shell-pouf',
    'undersea-room',
    1,
    require('../../../assets/rewards/room-materials/undersea-shell-pouf.png'),
  ),
  material(
    'undersea-pearl-lamp',
    'undersea-room',
    2,
    require('../../../assets/rewards/room-materials/undersea-pearl-lamp.png'),
  ),
  material(
    'undersea-starfish-decor',
    'undersea-room',
    3,
    require('../../../assets/rewards/room-materials/undersea-starfish-decor.png'),
  ),
  material(
    'undersea-bubble-decor',
    'undersea-room',
    4,
    require('../../../assets/rewards/room-materials/undersea-bubble-decor.png'),
  ),
  material(
    'sunset-cushion',
    'rainbow-cape',
    0,
    require('../../../assets/rewards/room-materials/sunset-cushion.png'),
  ),
  material(
    'sunset-sun-decor',
    'rainbow-cape',
    1,
    require('../../../assets/rewards/room-materials/sunset-sun-decor.png'),
  ),
  material(
    'sunset-leaf-pillow',
    'rainbow-cape',
    2,
    require('../../../assets/rewards/room-materials/sunset-leaf-pillow.png'),
  ),
  material(
    'sunset-small-plant',
    'rainbow-cape',
    3,
    require('../../../assets/rewards/room-materials/sunset-small-plant.png'),
  ),
  material(
    'sunset-mini-shelf',
    'rainbow-cape',
    4,
    require('../../../assets/rewards/room-materials/sunset-mini-shelf.png'),
  ),
] as const satisfies readonly RoomMaterial[];

const roomMaterialKeySet = new Set<string>(roomMaterialKeys);
const roomThemeKeySet = new Set<string>(roomThemeKeys);

export function isRoomMaterialKey(value: string): value is RoomMaterialKey {
  return roomMaterialKeySet.has(value);
}

export function isRoomThemeKey(value: string | undefined): value is RoomThemeKey {
  return typeof value === 'string' && roomThemeKeySet.has(value);
}

export function roomMaterialForKey(key: RoomMaterialKey): RoomMaterial {
  const item = roomMaterialCatalog.find((candidate) => candidate.key === key);
  if (!item) throw new Error(`Unknown room material: ${key}`);
  return item;
}

export function roomMaterialsForTheme(themeKey: string | undefined): readonly RoomMaterial[] {
  const safeThemeKey: RoomThemeKey = isRoomThemeKey(themeKey) ? themeKey : 'pastel-playroom';
  return roomMaterialCatalog.filter((item) => item.backgroundKey === safeThemeKey);
}

export function isRoomMaterialUnlocked(item: RoomMaterial, currentMineScore: number): boolean {
  return isBackgroundUnlockedForScore(item.backgroundKey, currentMineScore);
}
