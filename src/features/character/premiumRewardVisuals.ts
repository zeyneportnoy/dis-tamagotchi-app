import type { ImageSourcePropType } from 'react-native';

import type { RewardItemKey } from '@/domain/rewards';

const premiumRewardSources = {
  pastelPlayroom: require('../../../assets/rewards/premium/pastel-playroom.png'),
  cloudRoom: require('../../../assets/rewards/premium/cloud-room.png'),
  rainbowRoom: require('../../../assets/rewards/premium/rainbow-room.png'),
  nightRoom: require('../../../assets/rewards/premium/night-room.png'),
  underseaRoom: require('../../../assets/rewards/premium/undersea-room.png'),
  sunsetRoom: require('../../../assets/rewards/premium/sunset-room.png'),
  cloudCushion: require('../../../assets/rewards/premium/cloud-cushion.png'),
  heartRug: require('../../../assets/rewards/premium/heart-rug.png'),
  toyBox: require('../../../assets/rewards/premium/toy-box.png'),
  starLamp: require('../../../assets/rewards/premium/star-lamp.png'),
  miniPlant: require('../../../assets/rewards/premium/mini-plant.png'),
  miniShelf: require('../../../assets/rewards/premium/mini-shelf.png'),
  bubbles: require('../../../assets/rewards/premium/bubbles.png'),
  hearts: require('../../../assets/rewards/premium/hearts.png'),
  rainbowLight: require('../../../assets/rewards/premium/rainbow-light.png'),
  goldSparkle: require('../../../assets/rewards/premium/gold-sparkle.png'),
  starSparkle: require('../../../assets/rewards/premium/star-sparkle.png'),
  confetti: require('../../../assets/rewards/premium/confetti.png'),
  crown: require('../../../assets/rewards/premium/crown-transparent.png'),
  starHeadband: require('../../../assets/rewards/premium/star-headband.png'),
  sleepHat: require('../../../assets/rewards/premium/sleep-hat-transparent.png'),
  roundGlasses: require('../../../assets/rewards/premium/round-glasses.png'),
  heroMask: require('../../../assets/rewards/premium/hero-mask.png'),
  colorGlasses: require('../../../assets/rewards/premium/color-glasses.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export const collectionBackgroundKeys = [
  'pastel-playroom',
  'cloud-room',
  'rainbow-room',
  'space-room',
  'undersea-room',
  'rainbow-cape',
] as const satisfies readonly RewardItemKey[];

const collectionBackgroundKeySet = new Set<RewardItemKey>(collectionBackgroundKeys);

export function isCollectionBackgroundKey(key: RewardItemKey): boolean {
  return collectionBackgroundKeySet.has(key);
}

export function premiumRewardSource(key: RewardItemKey): ImageSourcePropType {
  const sourceByKey: Partial<Record<RewardItemKey, ImageSourcePropType>> = {
    'pastel-playroom': premiumRewardSources.pastelPlayroom,
    'cloud-room': premiumRewardSources.cloudRoom,
    'rainbow-room': premiumRewardSources.rainbowRoom,
    'space-room': premiumRewardSources.nightRoom,
    'night-room': premiumRewardSources.nightRoom,
    'undersea-room': premiumRewardSources.underseaRoom,
    'rainbow-cape': premiumRewardSources.sunsetRoom,
    'forest-room': premiumRewardSources.pastelPlayroom,
    'cozy-scarf': premiumRewardSources.cloudCushion,
    'heart-rug': premiumRewardSources.heartRug,
    'toy-box': premiumRewardSources.toyBox,
    'heart-badge': premiumRewardSources.starLamp,
    'star-badge': premiumRewardSources.miniPlant,
    'mini-shelf': premiumRewardSources.miniShelf,
    'moon-lamp': premiumRewardSources.starLamp,
    'color-pillow': premiumRewardSources.heartRug,
    'bubble-glow': premiumRewardSources.bubbles,
    'heart-flight': premiumRewardSources.hearts,
    'rainbow-light': premiumRewardSources.rainbowLight,
    'gold-sparkle': premiumRewardSources.goldSparkle,
    'star-sparkle': premiumRewardSources.starSparkle,
    'confetti-glow': premiumRewardSources.confetti,
    'magic-dust': premiumRewardSources.starSparkle,
    'cloud-effect': premiumRewardSources.bubbles,
    'sparkle-crown': premiumRewardSources.crown,
    'star-crown': premiumRewardSources.starHeadband,
    'mini-hat': premiumRewardSources.sleepHat,
    'star-glasses': premiumRewardSources.roundGlasses,
    'super-glasses': premiumRewardSources.heroMask,
    'color-glasses': premiumRewardSources.colorGlasses,
    'mini-halo': premiumRewardSources.starHeadband,
    'classic-brush': premiumRewardSources.bubbles,
    'pink-brush': premiumRewardSources.hearts,
    'star-brush': premiumRewardSources.goldSparkle,
    'mini-cape': premiumRewardSources.heroMask,
    'rainbow-brush': premiumRewardSources.rainbowLight,
    'dino-brush': premiumRewardSources.miniPlant,
    'space-brush': premiumRewardSources.nightRoom,
    'sparkle-brush': premiumRewardSources.starSparkle,
    'heart-brush': premiumRewardSources.hearts,
  };
  return sourceByKey[key] ?? premiumRewardSources.goldSparkle;
}
