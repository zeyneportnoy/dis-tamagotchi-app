import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system';
import type { RewardItemKey } from '@/domain/rewards';

export const characterSceneEffectKeys = [
  'rainbow-light',
  'gold-sparkle',
  'star-sparkle',
  'confetti-glow',
  'magic-dust',
  'cloud-effect',
] as const satisfies readonly RewardItemKey[];

export type CharacterSceneEffectKey = (typeof characterSceneEffectKeys)[number];

const characterSceneEffectKeySet = new Set<RewardItemKey>(characterSceneEffectKeys);

export function isCharacterSceneEffectKey(
  key: RewardItemKey | null | undefined,
): key is CharacterSceneEffectKey {
  return Boolean(key && characterSceneEffectKeySet.has(key));
}

type Props = Readonly<{
  animated?: boolean;
  effectKey: CharacterSceneEffectKey;
  testID?: string;
}>;

function StarDust({ phase }: Readonly<{ phase: Animated.Value }>) {
  const opacity = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.98, 0.6],
  });
  const scale = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.12, 0.9] });
  return (
    <Animated.View style={[styles.fill, { opacity, transform: [{ scale }] }]}>
      <Text style={[styles.star, styles.starDustOne]}>✦</Text>
      <Text style={[styles.star, styles.starDustTwo]}>★</Text>
      <Text style={[styles.star, styles.starDustThree]}>✦</Text>
      <Text style={[styles.star, styles.starDustFour]}>✧</Text>
    </Animated.View>
  );
}

function RainbowGlow({ phase }: Readonly<{ phase: Animated.Value }>) {
  const opacity = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.56, 0.84, 0.56],
  });
  const scale = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.985, 1.035, 0.985] });
  return (
    <Animated.View style={[styles.fill, { opacity, transform: [{ scale }] }]}>
      <View style={[styles.rainbowRing, styles.rainbowOuter]} />
      <View style={[styles.rainbowRing, styles.rainbowMiddle]} />
      <View style={[styles.rainbowRing, styles.rainbowInner]} />
    </Animated.View>
  );
}

function MagicLight({ phase }: Readonly<{ phase: Animated.Value }>) {
  const opacity = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.48, 0.74, 0.48],
  });
  const scale = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.94, 1.04, 0.94] });
  return (
    <Animated.View style={[styles.fill, { opacity, transform: [{ scale }] }]}>
      <View style={[styles.magicHalo, styles.magicHaloOuter]} />
      <View style={[styles.magicHalo, styles.magicHaloInner]} />
    </Animated.View>
  );
}

function TinyLights({ phase }: Readonly<{ phase: Animated.Value }>) {
  const opacity = phase.interpolate({
    inputRange: [0, 0.3, 0.75, 1],
    outputRange: [0.22, 0.95, 0.86, 0.22],
  });
  const translateY = phase.interpolate({ inputRange: [0, 1], outputRange: [7, -9] });
  return (
    <Animated.View style={[styles.fill, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.lightDot, styles.lightDotOne]} />
      <View style={[styles.lightDot, styles.lightDotTwo]} />
      <View style={[styles.lightDot, styles.lightDotThree]} />
      <View style={[styles.lightDot, styles.lightDotFour]} />
      <View style={[styles.lightDot, styles.lightDotFive]} />
    </Animated.View>
  );
}

function NightDust({ phase }: Readonly<{ phase: Animated.Value }>) {
  const opacity = phase.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.55, 0.98, 0.55],
  });
  return (
    <Animated.View style={[styles.fill, { opacity }]}>
      <Text style={[styles.nightStar, styles.nightStarOne]}>✦</Text>
      <Text style={[styles.nightStar, styles.nightStarTwo]}>✧</Text>
      <Text style={[styles.nightStar, styles.nightStarThree]}>★</Text>
      <View style={[styles.nightDot, styles.nightDotOne]} />
      <View style={[styles.nightDot, styles.nightDotTwo]} />
    </Animated.View>
  );
}

function Celebration({ phase }: Readonly<{ phase: Animated.Value }>) {
  const opacity = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.48, 1, 0.48],
  });
  const scale = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.94, 1.06, 0.94] });
  const translateY = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [5, -7, 5] });
  return (
    <Animated.View style={[styles.fill, { opacity, transform: [{ translateY }, { scale }] }]}>
      <Text style={[styles.celebrationStar, styles.celebrationOne]}>★</Text>
      <Text style={[styles.celebrationStar, styles.celebrationTwo]}>✦</Text>
      <Text style={[styles.celebrationStar, styles.celebrationThree]}>✧</Text>
      <View style={[styles.confetti, styles.confettiOne]} />
      <View style={[styles.confetti, styles.confettiTwo]} />
      <View style={[styles.confetti, styles.confettiThree]} />
      <View style={[styles.confetti, styles.confettiFour]} />
    </Animated.View>
  );
}

export function CharacterSceneEffect({ animated = true, effectKey, testID }: Props) {
  const [phase] = useState(() => new Animated.Value(animated ? 0 : 0.5));

  useEffect(() => {
    phase.stopAnimation();
    if (!animated) {
      phase.setValue(0.5);
      return;
    }
    phase.setValue(0);
    const loop = Animated.loop(
      Animated.timing(phase, { duration: 2600, toValue: 1, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, effectKey, phase]);

  return (
    <View pointerEvents="none" style={styles.effectLayer} testID={testID}>
      {effectKey === 'gold-sparkle' ? <StarDust phase={phase} /> : null}
      {effectKey === 'rainbow-light' ? <RainbowGlow phase={phase} /> : null}
      {effectKey === 'magic-dust' ? <MagicLight phase={phase} /> : null}
      {effectKey === 'star-sparkle' ? <TinyLights phase={phase} /> : null}
      {effectKey === 'cloud-effect' ? <NightDust phase={phase} /> : null}
      {effectKey === 'confetti-glow' ? <Celebration phase={phase} /> : null}
    </View>
  );
}

export function EffectCardPreview({ effectKey }: Readonly<{ effectKey: CharacterSceneEffectKey }>) {
  return (
    <View style={styles.cardPreview} testID={`collection-effect-card-preview-${effectKey}`}>
      {effectKey === 'gold-sparkle' ? (
        <>
          <Text style={[styles.cardStar, styles.cardStarOne]}>✦</Text>
          <Text style={[styles.cardStar, styles.cardStarTwo]}>★</Text>
          <Text style={[styles.cardStar, styles.cardStarThree]}>✧</Text>
        </>
      ) : null}
      {effectKey === 'rainbow-light' ? (
        <>
          <View style={[styles.cardRainbow, styles.cardRainbowOuter]} />
          <View style={[styles.cardRainbow, styles.cardRainbowMiddle]} />
          <View style={[styles.cardRainbow, styles.cardRainbowInner]} />
        </>
      ) : null}
      {effectKey === 'magic-dust' ? (
        <>
          <View style={[styles.cardHalo, styles.cardHaloOuter]} />
          <View style={[styles.cardHalo, styles.cardHaloInner]} />
        </>
      ) : null}
      {effectKey === 'star-sparkle' ? (
        <>
          <View style={[styles.cardLight, styles.cardLightOne]} />
          <View style={[styles.cardLight, styles.cardLightTwo]} />
          <View style={[styles.cardLight, styles.cardLightThree]} />
          <View style={[styles.cardLight, styles.cardLightFour]} />
        </>
      ) : null}
      {effectKey === 'cloud-effect' ? (
        <>
          <Text style={[styles.cardNightStar, styles.cardNightStarOne]}>✦</Text>
          <Text style={[styles.cardNightStar, styles.cardNightStarTwo]}>✧</Text>
          <View style={[styles.cardNightDot, styles.cardNightDotOne]} />
          <View style={[styles.cardNightDot, styles.cardNightDotTwo]} />
        </>
      ) : null}
      {effectKey === 'confetti-glow' ? (
        <>
          <Text style={[styles.cardCelebrationStar, styles.cardCelebrationStarOne]}>★</Text>
          <Text style={[styles.cardCelebrationStar, styles.cardCelebrationStarTwo]}>✦</Text>
          <View style={[styles.cardConfetti, styles.cardConfettiOne]} />
          <View style={[styles.cardConfetti, styles.cardConfettiTwo]} />
          <View style={[styles.cardConfetti, styles.cardConfettiThree]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardCelebrationStar: { fontSize: 15, lineHeight: 18, position: 'absolute' },
  cardCelebrationStarOne: { color: '#FFD166', left: 12, top: 8 },
  cardCelebrationStarTwo: { bottom: 8, color: '#9ADFD4', right: 10 },
  cardConfetti: { borderRadius: 2, height: 10, position: 'absolute', width: 4 },
  cardConfettiOne: {
    backgroundColor: '#E9A7CF',
    right: 12,
    top: 9,
    transform: [{ rotate: '28deg' }],
  },
  cardConfettiThree: {
    backgroundColor: '#B8A9EF',
    bottom: 9,
    left: 25,
    transform: [{ rotate: '-32deg' }],
  },
  cardConfettiTwo: {
    backgroundColor: '#FFD58F',
    left: 13,
    top: 31,
    transform: [{ rotate: '-24deg' }],
  },
  cardHalo: { borderRadius: 999, position: 'absolute' },
  cardHaloInner: {
    backgroundColor: 'rgba(255,247,211,0.92)',
    height: 29,
    left: 18,
    top: 14,
    width: 29,
  },
  cardHaloOuter: {
    backgroundColor: 'rgba(255,221,151,0.62)',
    height: 45,
    left: 10,
    top: 6,
    width: 45,
  },
  cardLight: { borderRadius: 4, height: 7, position: 'absolute', width: 7 },
  cardLightFour: { backgroundColor: '#F1B7D4', bottom: 9, right: 13 },
  cardLightOne: { backgroundColor: '#FFE5A5', left: 12, top: 12 },
  cardLightThree: { backgroundColor: '#9DE1D7', bottom: 11, left: 22 },
  cardLightTwo: { backgroundColor: '#BDB2F3', right: 14, top: 17 },
  cardNightDot: {
    backgroundColor: '#D7CCFF',
    borderRadius: 3,
    height: 5,
    position: 'absolute',
    width: 5,
  },
  cardNightDotOne: { bottom: 11, left: 17 },
  cardNightDotTwo: { right: 12, top: 13 },
  cardNightStar: { color: '#5D568F', fontSize: 15, lineHeight: 18, position: 'absolute' },
  cardNightStarOne: { left: 11, top: 8 },
  cardNightStarTwo: { bottom: 7, right: 13 },
  cardPreview: { height: 58, overflow: 'hidden', position: 'relative', width: 64 },
  cardRainbow: { borderRadius: 999, borderWidth: 4, position: 'absolute' },
  cardRainbowInner: {
    borderColor: 'rgba(111,202,190,0.88)',
    height: 29,
    left: 18,
    top: 14,
    width: 29,
  },
  cardRainbowMiddle: {
    borderColor: 'rgba(247,199,110,0.86)',
    height: 37,
    left: 14,
    top: 10,
    width: 37,
  },
  cardRainbowOuter: {
    borderColor: 'rgba(224,137,194,0.84)',
    height: 45,
    left: 10,
    top: 6,
    width: 45,
  },
  cardStar: { color: '#F4C94F', fontSize: 16, lineHeight: 19, position: 'absolute' },
  cardStarOne: { left: 10, top: 8 },
  cardStarThree: { bottom: 8, color: '#9FDCD2', left: 25 },
  cardStarTwo: { color: '#C0B0EE', right: 10, top: 19 },
  celebrationOne: { color: '#FFD166', left: 42, top: 82 },
  celebrationStar: { fontSize: 20, lineHeight: 24, position: 'absolute' },
  celebrationThree: { bottom: 72, color: '#8EDFD3', right: 46 },
  celebrationTwo: { color: '#E8A8D8', right: 42, top: 102 },
  confetti: { borderRadius: 3, height: 14, position: 'absolute', width: 6 },
  confettiFour: {
    backgroundColor: '#B9A7EF',
    bottom: 88,
    left: 58,
    transform: [{ rotate: '35deg' }],
  },
  confettiOne: {
    backgroundColor: '#8EDFD3',
    left: 62,
    top: 132,
    transform: [{ rotate: '-28deg' }],
  },
  confettiThree: {
    backgroundColor: '#FFD58F',
    right: 66,
    top: 164,
    transform: [{ rotate: '-38deg' }],
  },
  confettiTwo: {
    backgroundColor: '#F1A8BD',
    right: 62,
    top: 68,
    transform: [{ rotate: '28deg' }],
  },
  effectLayer: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  fill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  lightDot: { borderRadius: 7, height: 9, position: 'absolute', width: 9 },
  lightDotFive: { backgroundColor: '#F1B7D4', left: 84, top: 242 },
  lightDotFour: { backgroundColor: '#BDB2F3', right: 74, top: 224 },
  lightDotOne: { backgroundColor: '#FFE5A5', left: 58, top: 116 },
  lightDotThree: { backgroundColor: '#9DE1D7', right: 54, top: 132 },
  lightDotTwo: { backgroundColor: '#F4BCD9', left: 96, top: 72 },
  magicHalo: { borderRadius: 999, position: 'absolute' },
  magicHaloInner: {
    backgroundColor: 'rgba(255, 247, 211, 0.56)',
    height: 184,
    left: 68,
    top: 88,
    width: 184,
  },
  magicHaloOuter: {
    backgroundColor: 'rgba(255, 221, 151, 0.34)',
    height: 250,
    left: 35,
    top: 54,
    width: 250,
  },
  nightDot: {
    backgroundColor: '#D7CCFF',
    borderRadius: 4,
    height: 7,
    position: 'absolute',
    width: 7,
  },
  nightDotOne: { left: 72, top: 188 },
  nightDotTwo: { right: 70, top: 218 },
  nightStar: { color: '#5D568F', fontSize: 18, lineHeight: 22, position: 'absolute' },
  nightStarOne: { left: 48, top: 94 },
  nightStarThree: { bottom: 78, left: 82 },
  nightStarTwo: { right: 46, top: 122 },
  rainbowInner: {
    borderColor: 'rgba(111, 202, 190, 0.7)',
    height: 172,
    left: 75,
    top: 94,
    width: 170,
  },
  rainbowMiddle: {
    borderColor: 'rgba(247, 199, 110, 0.68)',
    height: 198,
    left: 62,
    top: 81,
    width: 196,
  },
  rainbowOuter: {
    borderColor: 'rgba(224, 137, 194, 0.66)',
    height: 224,
    left: 49,
    top: 68,
    width: 222,
  },
  rainbowRing: { borderRadius: 999, borderWidth: 11, position: 'absolute' },
  star: { color: '#F4C94F', fontSize: 20, lineHeight: 24, position: 'absolute' },
  starDustFour: { bottom: 76, color: '#A8DFD5', left: 58 },
  starDustOne: { left: 48, top: 90 },
  starDustThree: { bottom: 84, color: '#E5A6D4', right: 54 },
  starDustTwo: { color: '#C0B0EE', right: 48, top: 122 },
});
