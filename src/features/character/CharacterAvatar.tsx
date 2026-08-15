import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Text, radii } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import { rewardItemForKey, type CharacterGrowthStage, type RewardItemKey } from '@/domain/rewards';

type Size = 'tiny' | 'small' | 'large' | 'hero';
type Props = {
  accessoryKey?: RewardItemKey | null;
  accessoryKeys?: readonly RewardItemKey[];
  characterKey: StarterAvatarKey;
  growthStage?: CharacterGrowthStage;
  level?: number;
  mood?:
    'neutral' | 'happy' | 'proud' | 'sleepy' | 'dirty' | 'sad' | 'crying' | 'clean' | 'energetic';
  size?: Size;
  surface?: 'badge' | 'plain';
  phase?: 'resting' | 'crack-start' | 'cracking';
};

type LifecycleKey = 'egg' | 'cracking' | 'baby' | 'growing' | 'developed';
type LifecycleSources = Record<LifecycleKey, ImageSourcePropType>;

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

type MoodKey = 'neutral' | 'happy' | 'sleepy' | 'dirty' | 'sad' | 'crying' | 'proud';
const moodSources: Partial<Record<StarterAvatarKey, Record<MoodKey, ImageSourcePropType>>> = {
  inci: {
    neutral: require('../../../assets/characters/moods/inci/neutral.png'),
    happy: require('../../../assets/characters/moods/inci/happy.png'),
    sleepy: require('../../../assets/characters/moods/inci/sleepy.png'),
    dirty: require('../../../assets/characters/moods/inci/dirty.png'),
    sad: require('../../../assets/characters/moods/inci/sad.png'),
    crying: require('../../../assets/characters/moods/inci/crying.png'),
    proud: require('../../../assets/characters/moods/inci/proud.png'),
  },
  zipzip: {
    neutral: require('../../../assets/characters/moods/zipzip/neutral.png'),
    happy: require('../../../assets/characters/moods/zipzip/happy.png'),
    sleepy: require('../../../assets/characters/moods/zipzip/sleepy.png'),
    dirty: require('../../../assets/characters/moods/zipzip/dirty.png'),
    sad: require('../../../assets/characters/moods/zipzip/sad.png'),
    crying: require('../../../assets/characters/moods/zipzip/crying.png'),
    proud: require('../../../assets/characters/moods/zipzip/proud.png'),
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

export function CharacterAccessory({
  itemKey,
  preview = false,
}: {
  itemKey: RewardItemKey;
  preview?: boolean;
}) {
  const item = rewardItemForKey(itemKey);
  const isCrown = itemKey === 'sparkle-crown';
  const isGlasses = ['star-glasses', 'super-glasses', 'color-glasses'].includes(itemKey);
  const isWearable = item.slot === 'wearable';
  return (
    <View
      style={[
        styles.accessoryVisual,
        preview && styles.accessoryPreview,
        isWearable && styles.accessoryHead,
        isGlasses && styles.accessoryFace,
        item.slot === 'effect' && styles.accessoryEffect,
      ]}
      testID={`accessory-${itemKey}`}
    >
      {isCrown ? (
        <>
          <View style={styles.crownBase} />
          <View style={[styles.crownPoint, styles.crownPointLeft]} />
          <View style={[styles.crownPoint, styles.crownPointCenter]} />
          <View style={[styles.crownPoint, styles.crownPointRight]} />
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
        </View>
      ) : itemKey === 'mini-halo' ? (
        <View style={styles.halo} />
      ) : itemKey === 'mini-hat' ? (
        <>
          <View style={styles.hatTop} />
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
  const moodSource = stage === 3 ? moodSources[characterKey]?.[moodKey] : undefined;
  const [motion] = useState(() => new Animated.Value(0));
  const [tearMotion] = useState(() => new Animated.Value(0));
  const animated = size === 'large' || size === 'hero';
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

  useEffect(() => {
    if (!animated || mood !== 'crying') {
      tearMotion.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(tearMotion, {
        duration: 900,
        easing: Easing.in(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, mood, tearMotion]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        dimensions[size],
        surface === 'badge' && styles.badge,
        stage === 2 && styles.baby,
        stage === 3 && styles.growing,
        stage === 4 && styles.developed,
      ]}
      testID={`character-${characterKey}`}
    >
      {!isEgg && (stage >= 2 || mood === 'clean' || mood === 'proud') ? (
        <Text style={styles.sparkle}> ✦ </Text>
      ) : null}
      {mood === 'crying' ? (
        <View pointerEvents="none" style={styles.tearLayer} testID="character-animated-tears">
          <Animated.View
            style={[
              styles.tearDrop,
              styles.tearLeft,
              {
                opacity: tearMotion.interpolate({
                  inputRange: [0, 0.15, 0.82, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: tearMotion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 28],
                    }),
                  },
                  { rotate: '45deg' },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.tearDrop,
              styles.tearRight,
              {
                opacity: tearMotion.interpolate({
                  inputRange: [0, 0.25, 0.9, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: tearMotion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [3, 33],
                    }),
                  },
                  { rotate: '45deg' },
                ],
              },
            ]}
          />
        </View>
      ) : null}
      {mood === 'dirty' ? (
        <View style={styles.dirtLayer}>
          <View style={[styles.dirtSpot, styles.dirtSpotOne]} />
          <View style={[styles.dirtSpot, styles.dirtSpotTwo]} />
          <View style={[styles.dirtSpot, styles.dirtSpotThree]} />
        </View>
      ) : null}
      {!isEgg ? effectKeys.map((key) => <CharacterAccessory itemKey={key} key={key} />) : null}
      <Animated.View
        testID={isEgg ? `character-phase-${phase}` : `character-growth-stage-${stage}`}
        style={[
          styles.animatedCharacter,
          animated && {
            transform: [
              {
                translateX: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange:
                    mood === 'crying' ? [-3, 3] : mood === 'dirty' ? [-1.5, 1.5] : [0, 0],
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
                      : mood === 'dirty'
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
        <Image
          resizeMode="contain"
          source={moodSource ?? sources[characterKey][lifecycleKey]}
          style={[styles.image, mood === 'dirty' && styles.dirtyImage]}
          testID={`character-mood-${moodKey}`}
        />
        {stage === 0 && phase === 'crack-start' ? (
          <View pointerEvents="none" style={styles.firstCrack} testID="character-first-crack">
            <View style={[styles.crackLine, styles.crackLineOne]} />
            <View style={[styles.crackLine, styles.crackLineTwo]} />
            <View style={[styles.crackLine, styles.crackLineThree]} />
          </View>
        ) : null}
      </Animated.View>
      {!isEgg ? foregroundKeys.map((key) => <CharacterAccessory itemKey={key} key={key} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  accessoryVisual: { height: 54, position: 'absolute', width: 76, zIndex: 3 },
  accessoryPreview: { position: 'relative', transform: [{ scale: 1.1 }] },
  accessoryEffect: {
    height: '74%',
    opacity: 0.72,
    top: '20%',
    width: '112%',
    zIndex: 0,
  },
  accessoryFace: { top: '38%', transform: [{ scale: 0.82 }] },
  accessoryHead: { top: '18%', transform: [{ scale: 0.72 }] },
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
  },
  bowMiniLeft: { left: 0, transform: [{ rotate: '18deg' }] },
  bowMiniRight: { right: 0, transform: [{ rotate: '-18deg' }] },
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
  animatedCharacter: { height: '100%', width: '100%', zIndex: 1 },
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
  base: { alignItems: 'center', justifyContent: 'center' },
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
    backgroundColor: '#FFD166',
    borderColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    bottom: 4,
    height: 22,
    left: 7,
    position: 'absolute',
    width: 62,
  },
  crownPoint: {
    backgroundColor: '#FFD166',
    borderColor: '#FFF',
    borderRadius: 4,
    borderWidth: 2,
    height: 28,
    position: 'absolute',
    top: 4,
    transform: [{ rotate: '45deg' }],
    width: 28,
  },
  crownPointCenter: { left: 24, top: 0 },
  crownPointLeft: { left: 6, top: 8 },
  crownPointRight: { right: 6, top: 8 },
  crownStar: { color: '#8B5ED7', fontSize: 17, left: 29, position: 'absolute', top: 17 },
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
    borderColor: '#6C5CE7',
    borderRadius: 18,
    borderWidth: 5,
    height: 34,
    position: 'absolute',
    top: 10,
    width: 34,
  },
  glassLensLeft: { left: 1 },
  glassLensRight: { right: 1 },
  glassSuper: { backgroundColor: 'rgba(108,92,231,0.16)', borderColor: '#FF6B81' },
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
  dirtLayer: { height: '100%', position: 'absolute', width: '100%', zIndex: 4 },
  dirtSpot: {
    backgroundColor: 'rgba(139,105,75,0.34)',
    borderRadius: radii.pill,
    position: 'absolute',
  },
  dirtSpotOne: { height: 13, left: '25%', top: '42%', width: 17 },
  dirtSpotThree: { bottom: '24%', height: 10, left: '45%', width: 12 },
  dirtSpotTwo: { height: 16, right: '22%', top: '55%', width: 12 },
  dirtyImage: { opacity: 0.76 },
  growing: {},
  image: { height: '100%', width: '100%' },
  sparkle: { color: '#FFD166', fontSize: 30, position: 'absolute', right: -3, top: 8, zIndex: 4 },
  tearDrop: {
    backgroundColor: '#61C9F5',
    borderBottomRightRadius: 9,
    borderColor: 'rgba(255,255,255,0.88)',
    borderRadius: 7,
    borderWidth: 1.5,
    height: 14,
    position: 'absolute',
    top: '43%',
    width: 14,
  },
  tearLayer: { height: '100%', position: 'absolute', width: '100%', zIndex: 5 },
  tearLeft: { left: '30%' },
  tearRight: { right: '30%' },
});
