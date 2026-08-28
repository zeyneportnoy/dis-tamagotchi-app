import type { ImageSourcePropType } from 'react-native';

import type { StarterAvatarKey } from '@/domain/family';
import type { AccessorySlot, RewardItemKey } from '@/domain/rewards';

export type CharacterIconThemeSet = 'set1' | 'set2' | 'set3';
export type CharacterIconName =
  | 'home'
  | 'tasks'
  | 'collection'
  | 'profile'
  | 'background'
  | 'room'
  | 'effect'
  | 'accessory'
  | 'brush'
  | 'pastel-playroom'
  | 'cloud-room'
  | 'rainbow-room'
  | 'night-room';

export const characterIconThemeSet: Record<StarterAvatarKey, CharacterIconThemeSet> = {
  inci: 'set1',
  piril: 'set1',
  topi: 'set1',
  kaan: 'set1',
  akil: 'set1',
  uyku: 'set1',
  milo: 'set1',
  zipzip: 'set1',
};

const iconSources: Record<CharacterIconThemeSet, Record<CharacterIconName, ImageSourcePropType>> = {
  set1: {
    home: require('../../../assets/icons/character-themes/set1/home.png'),
    tasks: require('../../../assets/icons/character-themes/set1/tasks.png'),
    collection: require('../../../assets/icons/character-themes/set1/collection.png'),
    profile: require('../../../assets/icons/character-themes/set1/profile.png'),
    background: require('../../../assets/icons/character-themes/set1/background.png'),
    room: require('../../../assets/icons/character-themes/set1/room.png'),
    effect: require('../../../assets/icons/character-themes/set1/effect.png'),
    accessory: require('../../../assets/icons/character-themes/set1/accessory.png'),
    brush: require('../../../assets/icons/character-themes/set1/brush.png'),
    'pastel-playroom': require('../../../assets/icons/character-themes/set1/pastel-playroom.png'),
    'cloud-room': require('../../../assets/icons/character-themes/set1/cloud-room.png'),
    'rainbow-room': require('../../../assets/icons/character-themes/set1/rainbow-room.png'),
    'night-room': require('../../../assets/icons/character-themes/set1/night-room.png'),
  },
  set2: {
    home: require('../../../assets/icons/character-themes/set2/home.png'),
    tasks: require('../../../assets/icons/character-themes/set2/tasks.png'),
    collection: require('../../../assets/icons/character-themes/set2/collection.png'),
    profile: require('../../../assets/icons/character-themes/set2/profile.png'),
    background: require('../../../assets/icons/character-themes/set2/background.png'),
    room: require('../../../assets/icons/character-themes/set2/room.png'),
    effect: require('../../../assets/icons/character-themes/set2/effect.png'),
    accessory: require('../../../assets/icons/character-themes/set2/accessory.png'),
    brush: require('../../../assets/icons/character-themes/set1/brush.png'),
    'pastel-playroom': require('../../../assets/icons/character-themes/set2/pastel-playroom.png'),
    'cloud-room': require('../../../assets/icons/character-themes/set2/cloud-room.png'),
    'rainbow-room': require('../../../assets/icons/character-themes/set2/rainbow-room.png'),
    'night-room': require('../../../assets/icons/character-themes/set2/night-room.png'),
  },
  set3: {
    home: require('../../../assets/icons/character-themes/set3/home.png'),
    tasks: require('../../../assets/icons/character-themes/set3/tasks.png'),
    collection: require('../../../assets/icons/character-themes/set3/collection.png'),
    profile: require('../../../assets/icons/character-themes/set3/profile.png'),
    background: require('../../../assets/icons/character-themes/set3/background.png'),
    room: require('../../../assets/icons/character-themes/set3/room.png'),
    effect: require('../../../assets/icons/character-themes/set3/effect.png'),
    accessory: require('../../../assets/icons/character-themes/set3/accessory.png'),
    brush: require('../../../assets/icons/character-themes/set1/brush.png'),
    'pastel-playroom': require('../../../assets/icons/character-themes/set3/pastel-playroom.png'),
    'cloud-room': require('../../../assets/icons/character-themes/set3/cloud-room.png'),
    'rainbow-room': require('../../../assets/icons/character-themes/set3/rainbow-room.png'),
    'night-room': require('../../../assets/icons/character-themes/set3/night-room.png'),
  },
};

export function characterIconSource(
  characterKey: StarterAvatarKey,
  iconName: CharacterIconName,
): ImageSourcePropType {
  return iconSources[characterIconThemeSet[characterKey]][iconName];
}

export function categoryIconName(slot: AccessorySlot): CharacterIconName {
  if (slot === 'background') return 'background';
  if (slot === 'brush') return 'brush';
  if (slot === 'decor') return 'room';
  if (slot === 'effect') return 'effect';
  return 'accessory';
}

export function rewardIconName(key: RewardItemKey, slot: AccessorySlot): CharacterIconName {
  if (key === 'pastel-playroom') return 'pastel-playroom';
  if (key === 'cloud-room' || key === 'cozy-scarf' || key === 'cloud-effect') return 'cloud-room';
  if (
    key === 'rainbow-room' ||
    key === 'rainbow-cape' ||
    key === 'rainbow-light' ||
    key === 'rainbow-brush' ||
    key === 'color-glasses'
  )
    return 'rainbow-room';
  if (key === 'night-room' || key === 'moon-lamp' || key === 'space-room' || key === 'space-brush')
    return 'night-room';
  return categoryIconName(slot);
}
