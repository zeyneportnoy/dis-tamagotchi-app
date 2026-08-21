import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Text, radii } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import { rewardItemForKey, type CharacterGrowthStage, type RewardItemKey } from '@/domain/rewards';

import { moodSources, type MoodKey } from './assets/moodSources';

type Size = 'tiny' | 'small' | 'large' | 'hero';
type Props = {
  accessoryKey?: RewardItemKey | null;
  accessoryKeys?: readonly RewardItemKey[];
  characterKey: StarterAvatarKey;
  growthStage?: CharacterGrowthStage;
  level?: number;
  mood?:
    'neutral' | 'happy' | 'proud' | 'sleepy' | 'waiting' | 'sad' | 'crying' | 'clean' | 'energetic';
  size?: Size;
  surface?: 'badge' | 'plain';
  phase?: 'resting' | 'crack-start' | 'cracking';
  motionEnabled?: boolean;
};

type LifecycleKey = 'egg' | 'cracking' | 'baby' | 'growing' | 'developed';
type LifecycleSources = Record<LifecycleKey, ImageSourcePropType>;
type AccessoryAnchorKind = 'effect' | 'face' | 'head';
type AccessoryAnchor = Readonly<{ scale: number; top: `${number}%`; translateX: number }>;

const stageAnchorTop: Record<AccessoryAnchorKind, Record<LifecycleKey, number>> = {
  head: { egg: -4, cracking: -3, baby: 0, growing: 2, developed: 4 },
  face: { egg: 29, cracking: 30, baby: 29, growing: 31, developed: 33 },
  effect: { egg: 13, cracking: 13, baby: 14, growing: 14, developed: 15 },
};

const characterAnchorAdjustment: Record<
  StarterAvatarKey,
  Record<AccessoryAnchorKind, Readonly<{ top: number; x: number }>>
> = {
  inci: { head: { top: 0, x: 0 }, face: { top: 0, x: 0 }, effect: { top: 0, x: 0 } },
  piril: { head: { top: -1, x: -8 }, face: { top: 0, x: -2 }, effect: { top: 0, x: 0 } },
  kaan: { head: { top: -2, x: -3 }, face: { top: -1, x: 0 }, effect: { top: 0, x: 0 } },
  milo: { head: { top: -2, x: 2 }, face: { top: 0, x: 1 }, effect: { top: 0, x: 0 } },
  zipzip: { head: { top: -1, x: 0 }, face: { top: 0, x: 0 }, effect: { top: 0, x: 0 } },
  topi: { head: { top: -1, x: 2 }, face: { top: 1, x: 0 }, effect: { top: 0, x: 0 } },
  akil: { head: { top: -1, x: 0 }, face: { top: -1, x: 0 }, effect: { top: 0, x: 0 } },
  uyku: { head: { top: -2, x: 1 }, face: { top: 1, x: 0 }, effect: { top: 0, x: 0 } },
};

const accessoryScaleForSize: Record<Size, number> = {
  tiny: 0.28,
  small: 0.42,
  large: 0.78,
  hero: 1,
};

export function accessoryAnchorFor(
  characterKey: StarterAvatarKey,
  lifecycleKey: LifecycleKey,
  kind: AccessoryAnchorKind,
  size: Size,
): AccessoryAnchor {
  const adjustment = characterAnchorAdjustment[characterKey][kind];
  return {
    scale: accessoryScaleForSize[size] * (kind === 'effect' ? 1.08 : 1),
    top: `${stageAnchorTop[kind][lifecycleKey] + adjustment.top}%`,
    translateX: adjustment.x,
  };
}

const sources: Record<StarterAvatarKey, LifecycleSources> = {
  inci: {
    egg: require('../../../assets/characters/lifecycle/inci/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/inci/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/inci/baby.png'),
    growing: require('../../../assets/characters/lifecycle/inci/growing.png'),
    developed: require('../../../assets/characters/lifecycle/inci/developed.png'),
  },
  piril: {
    egg: require('../../../assets/characters/lifecycle/piril/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/piril/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/piril/baby.png'),
    growing: require('../../../assets/characters/lifecycle/piril/growing.png'),
    developed: require('../../../assets/characters/lifecycle/piril/developed.png'),
  },
  kaan: {
    egg: require('../../../assets/characters/lifecycle/kaan/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/kaan/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/kaan/baby.png'),
    growing: require('../../../assets/characters/lifecycle/kaan/growing.png'),
    developed: require('../../../assets/characters/lifecycle/kaan/developed.png'),
  },
  milo: {
    egg: require('../../../assets/characters/lifecycle/milo/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/milo/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/milo/baby.png'),
    growing: require('../../../assets/characters/lifecycle/milo/growing.png'),
    developed: require('../../../assets/characters/lifecycle/milo/developed.png'),
  },
  zipzip: {
    egg: require('../../../assets/characters/lifecycle/zipzip/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/zipzip/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/zipzip/baby.png'),
    growing: require('../../../assets/characters/lifecycle/zipzip/growing.png'),
    developed: require('../../../assets/characters/lifecycle/zipzip/developed.png'),
  },
  topi: {
    egg: require('../../../assets/characters/lifecycle/topi/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/topi/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/topi/baby.png'),
    growing: require('../../../assets/characters/lifecycle/topi/growing.png'),
    developed: require('../../../assets/characters/lifecycle/topi/developed.png'),
  },
  akil: {
    egg: require('../../../assets/characters/lifecycle/akil/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/akil/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/akil/baby.png'),
    growing: require('../../../assets/characters/lifecycle/akil/growing.png'),
    developed: require('../../../assets/characters/lifecycle/akil/developed.png'),
  },
  uyku: {
    egg: require('../../../assets/characters/lifecycle/uyku/egg.png'),
    cracking: require('../../../assets/characters/lifecycle/uyku/cracking.png'),
    baby: require('../../../assets/characters/lifecycle/uyku/baby.png'),
    growing: require('../../../assets/characters/lifecycle/uyku/growing.png'),
    developed: require('../../../assets/characters/lifecycle/uyku/developed.png'),
  },
};

const idlePersonality: Record<StarterAvatarKey, { duration: number; lift: number; tilt: number }> =
  {
    inci: { duration: 1050, lift: 5, tilt: 0.8 },
    piril: { duration: 820, lift: 7, tilt: 1.2 },
    kaan: { duration: 1180, lift: 4, tilt: 0.5 },
    milo: { duration: 980, lift: 5, tilt: 1.4 },
    zipzip: { duration: 560, lift: 10, tilt: 2.2 },
    topi: { duration: 670, lift: 8, tilt: 1.8 },
    akil: { duration: 1320, lift: 3, tilt: 0.4 },
    uyku: { duration: 1750, lift: 2, tilt: 0.7 },
  };

const dimensions: Record<Size, { height: number; width: number }> = {
  tiny: { height: 52, width: 42 },
  small: { height: 78, width: 64 },
  large: { height: 224, width: 186 },
  hero: { height: 294, width: 244 },
};

/**
 * Motion-safe scene viewport for the complete character composition (artwork, mood and rewards).
 * The artwork keeps its original display size; this extra transparent space prevents parent scenes
 * from clipping rotated/scaled animation frames or accessory/effect layers.
 */
export const characterSafeViewport: Record<Size, { height: number; width: number }> = {
  tiny: { height: 52, width: 42 },
  small: { height: 78, width: 64 },
  large: { height: 282, width: 250 },
  hero: { height: 354, width: 320 },
};

export function CharacterAccessory({
  characterKey,
  itemKey,
  lifecycleKey,
  preview = false,
  size = 'hero',
}: {
  characterKey?: StarterAvatarKey;
  itemKey: RewardItemKey;
  lifecycleKey?: LifecycleKey;
  preview?: boolean;
  size?: Size;
}) {
  const item = rewardItemForKey(itemKey);
  const isCrown = itemKey === 'sparkle-crown';
  const isGlasses = ['star-glasses', 'super-glasses', 'color-glasses'].includes(itemKey);
  const isWearable = item.slot === 'wearable';
  const anchorKind: AccessoryAnchorKind =
    item.slot === 'effect' ? 'effect' : isGlasses ? 'face' : 'head';
  const anchor =
    !preview && characterKey && lifecycleKey
      ? accessoryAnchorFor(characterKey, lifecycleKey, anchorKind, size)
      : null;
  return (
    <View
      style={[
        styles.accessoryVisual,
        preview && styles.accessoryPreview,
        !preview && isWearable && styles.accessoryHead,
        !preview && isGlasses && styles.accessoryFace,
        item.slot === 'effect' && styles.accessoryEffect,
        anchor && {
          top: anchor.top,
          transform: [{ translateX: anchor.translateX }, { scale: anchor.scale }],
        },
      ]}
      testID={`accessory-${itemKey}`}
    >
      {isCrown ? (
        <>
          <View style={styles.crownGlow} />
          <View style={styles.crownBase} />
          <View style={styles.crownBand} />
          <View style={[styles.crownPoint, styles.crownPointLeft]} />
          <View style={[styles.crownPoint, styles.crownPointCenter]} />
          <View style={[styles.crownPoint, styles.crownPointRight]} />
          <View style={[styles.crownJewel, styles.crownJewelLeft]} />
          <View style={[styles.crownJewel, styles.crownJewelCenter]} />
          <View style={[styles.crownJewel, styles.crownJewelRight]} />
          <Text style={styles.crownShine}>✦</Text>
        </>
      ) : itemKey === 'star-crown' ? (
        <View style={styles.hairBand}>
          <Text style={styles.hairBandStar}>★</Text>
        </View>
      ) : itemKey === 'bow-clip' ? (
        <View style={styles.bowClip}>
          <View style={[styles.bowMiniLoop, styles.bowMiniLeft]} />
          <View style={[styles.bowMiniLoop, styles.bowMiniRight]} />
          <View style={styles.bowMiniCenter} />
          <View style={styles.bowMiniShine} />
        </View>
      ) : itemKey === 'mini-halo' ? (
        <View style={styles.halo} />
      ) : itemKey === 'mini-hat' ? (
        <>
          <View style={styles.hatTop} />
          <View style={styles.hatHighlight} />
          <View style={styles.hatBand} />
          <View style={styles.hatBrim} />
        </>
      ) : isGlasses ? (
        <>
          <View
            style={[
              styles.glassLens,
              styles.glassLensLeft,
              itemKey === 'color-glasses' && styles.glassColor,
              itemKey === 'super-glasses' && styles.glassSuper,
            ]}
          />
          <View
            style={[
              styles.glassLens,
              styles.glassLensRight,
              itemKey === 'color-glasses' && styles.glassColor,
              itemKey === 'super-glasses' && styles.glassSuper,
            ]}
          />
          <View
            style={[styles.glassBridge, itemKey === 'color-glasses' && styles.glassBridgeColor]}
          />
          <View style={[styles.glassShine, styles.glassShineLeft]} />
          <View style={[styles.glassShine, styles.glassShineRight]} />
        </>
      ) : item.slot === 'effect' ? (
        <>
          <View style={[styles.capeWing, styles.capeWingLeft]} />
          <View style={[styles.capeWing, styles.capeWingRight]} />
          <Text style={styles.capeStar}>
            {itemKey === 'confetti-glow' ? '✶' : itemKey === 'mini-cape' ? '★' : '✦'}
          </Text>
        </>
      ) : (
        <Text style={styles.collectionIcon}>{item.icon}</Text>
      )}
    </View>
  );
}

export function CharacterAvatar({
  accessoryKey,
  accessoryKeys,
  characterKey,
  growthStage,
  level = 1,
  mood = 'happy',
  motionEnabled = true,
  size = 'large',
  surface = 'badge',
  phase = 'resting',
}: Props) {
  const stage: CharacterGrowthStage = growthStage ?? (Math.max(2, Math.min(4, level)) as 2 | 3 | 4);
  const isEgg = stage === 0;
  const lifecycleKey: LifecycleKey =
    stage === 0
      ? phase === 'cracking'
        ? 'cracking'
        : 'egg'
      : stage === 1
        ? 'cracking'
        : stage === 2
          ? 'baby'
          : stage === 3
            ? 'growing'
            : 'developed';
  const moodKey: MoodKey =
    mood === 'clean' || mood === 'proud' ? 'proud' : mood === 'energetic' ? 'happy' : mood;
  const personality = idlePersonality[characterKey];
  const moodSource = moodSources[characterKey][lifecycleKey][moodKey];
  const [motion] = useState(() => new Animated.Value(0));
  const animated = motionEnabled && (size === 'large' || size === 'hero');
  const equippedKeys = accessoryKeys ?? (accessoryKey ? [accessoryKey] : []);
  const effectKeys = equippedKeys.filter((key) => rewardItemForKey(key).slot === 'effect');
  const foregroundKeys = equippedKeys.filter((key) => rewardItemForKey(key).slot === 'wearable');
  const stageLift = stage === 0 ? 2 : stage === 1 ? 5 : stage === 2 ? 7 : stage === 3 ? 11 : 8;
  const stageTilt =
    stage === 0 ? 0.8 : stage === 1 ? 2.8 : stage === 2 ? 1.5 : stage === 3 ? 2 : 0.7;
  const stageScale = stage === 0 ? 1.012 : stage === 1 ? 1.025 : stage === 4 ? 1.045 : 1.03;
  const stageMotionDuration =
    phase === 'cracking'
      ? 210
      : stage === 0
        ? 980
        : stage === 1
          ? 320
          : stage === 2
            ? personality.duration * 0.8
            : stage === 3
              ? personality.duration * 0.58
              : personality.duration * 0.9;
  const stageRestDuration = stage === 0 ? 720 : stage === 1 ? 120 : stage === 4 ? 420 : 180;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          duration:
            mood === 'happy' || mood === 'energetic'
              ? stageMotionDuration * 0.7
              : stageMotionDuration,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          duration:
            mood === 'happy' || mood === 'energetic'
              ? stageMotionDuration * 0.7
              : stageMotionDuration,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.delay(stageRestDuration),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, mood, motion, stageMotionDuration, stageRestDuration]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        characterSafeViewport[size],
        surface === 'badge' && styles.badge,
        stage === 2 && styles.baby,
        stage === 3 && styles.growing,
        stage === 4 && styles.developed,
      ]}
      testID={`character-${characterKey}`}
    >
      <Animated.View
        testID={isEgg ? `character-phase-${phase}` : `character-growth-stage-${stage}`}
        style={[
          styles.animatedCharacter,
          dimensions[size],
          animated && {
            transform: [
              {
                translateX: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange:
                    mood === 'crying' ? [-3, 3] : mood === 'waiting' ? [-1.5, 1.5] : [0, 0],
                }),
              },
              {
                translateY: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    mood === 'sad' || mood === 'crying' ? 3 : 0,
                    mood === 'happy' || mood === 'energetic'
                      ? -Math.max(personality.lift, stageLift) * 1.45
                      : mood === 'proud'
                        ? -3
                        : mood === 'sleepy'
                          ? 1
                          : -stageLift * 0.45,
                  ],
                }),
              },
              {
                rotate: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange:
                    mood === 'crying'
                      ? ['-2.5deg', '2.5deg']
                      : mood === 'waiting'
                        ? ['-1.8deg', '1.8deg']
                        : mood === 'sleepy'
                          ? ['-0.3deg', '0.3deg']
                          : [
                              `${-Math.max(personality.tilt, stageTilt)}deg`,
                              `${Math.max(personality.tilt, stageTilt)}deg`,
                            ],
                }),
              },
              {
                scale: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange:
                    mood === 'proud'
                      ? [1, 1.045]
                      : mood === 'happy' || mood === 'energetic'
                        ? [1, 1.025]
                        : [1, stageScale],
                }),
              },
            ],
          },
        ]}
      >
        {!isEgg &&
        (size === 'large' || size === 'hero') &&
        (stage >= 2 || mood === 'clean' || mood === 'proud') ? (
          <Text style={styles.sparkle}> ✦ </Text>
        ) : null}
        {effectKeys.map((key) => (
          <CharacterAccessory
            characterKey={characterKey}
            itemKey={key}
            key={key}
            lifecycleKey={lifecycleKey}
            size={size}
          />
        ))}
        <Image
          resizeMode="contain"
          source={moodSource ?? sources[characterKey][lifecycleKey]}
          style={styles.image}
          testID={`character-mood-${moodKey}`}
        />
        {stage === 0 && phase === 'crack-start' ? (
          <View pointerEvents="none" style={styles.firstCrack} testID="character-first-crack">
            <View style={[styles.crackLine, styles.crackLineOne]} />
            <View style={[styles.crackLine, styles.crackLineTwo]} />
            <View style={[styles.crackLine, styles.crackLineThree]} />
          </View>
        ) : null}
        {foregroundKeys.map((key) => (
          <CharacterAccessory
            characterKey={characterKey}
            itemKey={key}
            key={key}
            lifecycleKey={lifecycleKey}
            size={size}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  accessoryVisual: {
    height: 54,
    left: '50%',
    marginLeft: -38,
    position: 'absolute',
    width: 76,
    zIndex: 3,
  },
  accessoryPreview: { left: 0, marginLeft: 0, position: 'relative', transform: [{ scale: 1.1 }] },
  accessoryEffect: {
    height: '74%',
    left: '-6%',
    marginLeft: 0,
    opacity: 0.72,
    top: '20%',
    width: '112%',
    zIndex: 0,
  },
  accessoryFace: {},
  accessoryHead: {},
  collectionIcon: { fontSize: 38 },
  bowClip: { height: 36, left: 44, position: 'absolute', top: 14, width: 36 },
  bowMiniCenter: {
    backgroundColor: '#FF6B9A',
    borderColor: '#FFF',
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    left: 11,
    position: 'absolute',
    top: 10,
    width: 14,
  },
  bowMiniLoop: {
    backgroundColor: '#FF9FC6',
    borderColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    height: 22,
    position: 'absolute',
    top: 6,
    width: 20,
    shadowColor: '#B84172',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
  },
  bowMiniLeft: { left: 0, transform: [{ rotate: '18deg' }] },
  bowMiniRight: { right: 0, transform: [{ rotate: '-18deg' }] },
  bowMiniShine: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.pill,
    height: 4,
    left: 8,
    position: 'absolute',
    top: 9,
    transform: [{ rotate: '-18deg' }],
    width: 8,
  },
  halo: {
    borderColor: '#FFD166',
    borderRadius: 30,
    borderWidth: 6,
    height: 18,
    left: 8,
    position: 'absolute',
    top: 10,
    width: 60,
  },
  hairBand: {
    backgroundColor: '#FF9FC6',
    borderRadius: 8,
    height: 8,
    left: 8,
    position: 'absolute',
    top: 28,
    width: 60,
  },
  hairBandStar: { color: '#FFD166', fontSize: 24, left: 19, position: 'absolute', top: -18 },
  animatedCharacter: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
    zIndex: 1,
  },
  badgeMedal: {
    alignItems: 'center',
    backgroundColor: '#FFD166',
    borderColor: '#FFF7D6',
    borderRadius: 18,
    borderWidth: 3,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  badgeStar: { color: '#8B5ED7', fontSize: 18, lineHeight: 20 },
  badgeHeart: { backgroundColor: '#FF9FC6' },
  badgePurple: { backgroundColor: '#B89AF4' },
  badge: { backgroundColor: '#FFF0C9', borderRadius: radii.pill },
  baby: {},
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  bowCenter: {
    backgroundColor: '#FF6B9A',
    borderColor: '#FFF',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    left: 28,
    position: 'absolute',
    top: 18,
    width: 20,
  },
  bowLoop: {
    backgroundColor: '#FF9BC0',
    borderColor: '#FFF',
    borderRadius: 18,
    borderWidth: 2,
    height: 32,
    position: 'absolute',
    top: 12,
    width: 34,
  },
  bowLoopLeft: { left: 2, transform: [{ rotate: '18deg' }] },
  bowLoopRight: { right: 2, transform: [{ rotate: '-18deg' }] },
  capeStar: { color: '#FFD166', fontSize: 20, left: 49, position: 'absolute', top: 16 },
  capeWing: {
    backgroundColor: '#8B6DE9',
    borderColor: '#FFF',
    borderRadius: 26,
    borderWidth: 2,
    height: 48,
    position: 'absolute',
    top: 4,
    width: 55,
  },
  capeWingLeft: { left: 2, transform: [{ rotate: '18deg' }] },
  capeWingRight: { right: 2, transform: [{ rotate: '-18deg' }] },
  crownBase: {
    backgroundColor: '#F6BD58',
    borderColor: '#FFF4C7',
    borderRadius: 10,
    borderWidth: 3,
    bottom: 3,
    height: 23,
    left: 6,
    position: 'absolute',
    shadowColor: '#A65D30',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    width: 64,
  },
  crownBand: {
    backgroundColor: '#FFE89C',
    borderRadius: 6,
    bottom: 9,
    height: 7,
    left: 11,
    position: 'absolute',
    width: 54,
  },
  crownPoint: {
    backgroundColor: '#FFD879',
    borderColor: '#FFF4C7',
    borderRadius: 7,
    borderWidth: 2,
    height: 25,
    position: 'absolute',
    top: 7,
    transform: [{ rotate: '45deg' }],
    width: 25,
  },
  crownPointCenter: { left: 26, top: 1 },
  crownPointLeft: { left: 9, top: 9 },
  crownPointRight: { right: 9, top: 9 },
  crownGlow: {
    backgroundColor: 'rgba(255,232,156,0.3)',
    borderRadius: radii.pill,
    height: 44,
    left: 3,
    position: 'absolute',
    top: 0,
    width: 70,
  },
  crownJewel: {
    borderColor: '#FFF7DA',
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: 9,
    height: 8,
    position: 'absolute',
    width: 8,
    zIndex: 2,
  },
  crownJewelCenter: { backgroundColor: '#8B6DE9', left: 34 },
  crownJewelLeft: { backgroundColor: '#FF7FA0', left: 18 },
  crownJewelRight: { backgroundColor: '#42D6C5', right: 18 },
  crownShine: { color: '#FFF', fontSize: 12, left: 47, position: 'absolute', top: 1, zIndex: 3 },
  glassBridge: {
    backgroundColor: '#6C5CE7',
    height: 5,
    left: 33,
    position: 'absolute',
    top: 25,
    width: 11,
  },
  glassBridgeColor: { backgroundColor: '#42D6C5' },
  glassColor: { borderColor: '#42D6C5' },
  glassLens: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderColor: '#6C5CE7',
    borderRadius: 18,
    borderWidth: 5,
    height: 34,
    position: 'absolute',
    top: 10,
    width: 34,
    shadowColor: '#4C3E9F',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
  },
  glassLensLeft: { left: 1 },
  glassLensRight: { right: 1 },
  glassSuper: { backgroundColor: 'rgba(108,92,231,0.16)', borderColor: '#FF6B81' },
  glassShine: {
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderRadius: radii.pill,
    height: 4,
    position: 'absolute',
    top: 17,
    transform: [{ rotate: '-28deg' }],
    width: 9,
  },
  glassShineLeft: { left: 9 },
  glassShineRight: { right: 9 },
  hatBand: {
    backgroundColor: '#FF6B81',
    height: 8,
    left: 17,
    position: 'absolute',
    top: 31,
    width: 42,
  },
  hatBrim: {
    backgroundColor: '#40325F',
    borderRadius: 8,
    height: 9,
    left: 7,
    position: 'absolute',
    top: 38,
    width: 62,
  },
  hatTop: {
    backgroundColor: '#554276',
    borderRadius: 10,
    height: 33,
    left: 18,
    position: 'absolute',
    top: 4,
    width: 40,
    shadowColor: '#241933',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  hatHighlight: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radii.pill,
    height: 5,
    left: 24,
    position: 'absolute',
    top: 9,
    transform: [{ rotate: '-12deg' }],
    width: 16,
  },
  developed: {},
  firstCrack: {
    height: '100%',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  crackLine: {
    backgroundColor: '#7B69A8',
    borderRadius: 2,
    height: 3,
    left: '50%',
    position: 'absolute',
    top: '34%',
  },
  crackLineOne: { transform: [{ rotate: '54deg' }], width: '12%' },
  crackLineTwo: { left: '56%', transform: [{ rotate: '128deg' }], width: '9%' },
  crackLineThree: { left: '54%', top: '40%', transform: [{ rotate: '82deg' }], width: '8%' },
  growing: {},
  image: { height: '100%', width: '100%' },
  sparkle: { color: '#FFD166', fontSize: 30, position: 'absolute', right: -3, top: 8, zIndex: 4 },
});
