import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';

export type SceneTone =
  'blue' | 'green' | 'navy' | 'orange' | 'pink' | 'purple' | 'turquoise' | 'yellow';
type Props = {
  density?: 'calm' | 'playful';
  tone?: SceneTone;
};

const toneColors: Record<SceneTone, { base: string; glow: string; wash: string }> = {
  blue: { base: '#B9DEFF', glow: '#F3FAFF', wash: '#86C2F5' },
  pink: { base: '#F7C7E0', glow: '#FFF2F8', wash: '#E79ED0' },
  green: { base: '#BFE8CB', glow: '#F4FFF3', wash: '#83C99D' },
  purple: { base: '#D8C2F5', glow: '#FBF4FF', wash: '#AA83DC' },
  turquoise: { base: '#AEE7E8', glow: '#F1FFFF', wash: '#60C7CF' },
  yellow: { base: '#FFE6A1', glow: '#FFFBEA', wash: '#F4C95B' },
  orange: { base: '#FFD0A3', glow: '#FFF6E9', wash: '#F3A35E' },
  navy: { base: '#A9B9E8', glow: '#EEF2FF', wash: '#667CC4' },
};

export function sceneToneForCharacter(characterKey: StarterAvatarKey): SceneTone {
  return {
    inci: 'blue',
    piril: 'pink',
    kaan: 'green',
    milo: 'purple',
    zipzip: 'turquoise',
    topi: 'yellow',
    akil: 'orange',
    uyku: 'navy',
  }[characterKey] as SceneTone;
}

export function sceneBackgroundForCharacter(characterKey: StarterAvatarKey): string {
  return toneColors[sceneToneForCharacter(characterKey)].base;
}

export function CharacterScreenBackdrop({ characterKey }: { characterKey: StarterAvatarKey }) {
  const palette = toneColors[sceneToneForCharacter(characterKey)];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.screenBackdrop, { backgroundColor: palette.base }]}
      testID={`character-screen-theme-${characterKey}`}
    >
      <View style={[styles.screenTopWash, { backgroundColor: palette.glow }]} />
      <View style={[styles.screenBottomWash, { backgroundColor: palette.wash }]} />
      <View style={[styles.screenGlow, { backgroundColor: palette.glow }]} />
      <View style={[styles.screenCloud, styles.screenCloudLeft]} />
      <View style={[styles.screenCloud, styles.screenCloudRight]} />
      <View style={[styles.screenBubble, styles.screenBubbleOne]} />
      <View style={[styles.screenBubble, styles.screenBubbleTwo]} />
      <Text style={[styles.screenSparkle, styles.screenSparkleOne]}>✦</Text>
      <Text style={[styles.screenSparkle, styles.screenSparkleTwo]}>✧</Text>
      <Text style={[styles.screenSparkle, styles.screenSparkleThree]}>•</Text>
    </View>
  );
}

export function CharacterSceneDecor({ density = 'playful', tone = 'blue' }: Props) {
  const palette = toneColors[tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.layer}
      testID="character-scene-decor"
    >
      <View style={[styles.baseWash, { backgroundColor: palette.base }]} />
      <View style={[styles.topWash, { backgroundColor: palette.wash }]} />
      <View style={[styles.sideWash, { backgroundColor: palette.glow }]} />
      <View style={[styles.haloOuter, { backgroundColor: palette.glow }]} />
      <View style={styles.haloInner} />
      <View style={[styles.cloudCluster, styles.cloudClusterLeft]}>
        <View style={[styles.cloud, styles.cloudLarge]} />
        <View style={[styles.cloud, styles.cloudSmall]} />
      </View>
      <View style={[styles.cloudCluster, styles.cloudClusterRight]}>
        <View style={[styles.cloud, styles.cloudLarge]} />
        <View style={[styles.cloud, styles.cloudSmall]} />
      </View>
      <View style={styles.groundShadow} />
      <View style={[styles.pedestal, { borderColor: palette.glow }]} />
      <View style={[styles.bubble, styles.bubbleLeft]} />
      <View style={[styles.bubble, styles.bubbleRight]} />
      {density === 'playful' ? (
        <>
          <Text style={[styles.sparkle, styles.sparkleLeft]}>✦</Text>
          <Text style={[styles.sparkle, styles.sparkleRight]}>✧</Text>
          <Text style={[styles.sparkle, styles.sparkleTop]}>•</Text>
          <Text style={[styles.sparkle, styles.sparkleBottom]}>✦</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  baseWash: { bottom: 0, left: 0, opacity: 0.74, position: 'absolute', right: 0, top: 0 },
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.pill,
    borderWidth: 2,
    position: 'absolute',
  },
  bubbleLeft: { height: 20, left: 24, top: 78, width: 20 },
  bubbleRight: { height: 14, right: 30, top: 118, width: 14 },
  cloud: {
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: radii.pill,
    height: 28,
    position: 'absolute',
    width: 92,
  },
  cloudCluster: { height: 54, position: 'absolute', width: 118 },
  cloudClusterLeft: { left: -24, top: 116, transform: [{ rotate: '-4deg' }] },
  cloudClusterRight: { right: -30, top: 70, transform: [{ rotate: '5deg' }] },
  cloudLarge: { bottom: 0, left: 0 },
  cloudSmall: { height: 38, left: 28, top: 0, width: 54 },
  groundShadow: {
    backgroundColor: 'rgba(91,69,126,0.13)',
    borderRadius: radii.pill,
    bottom: 20,
    height: 34,
    left: '22%',
    position: 'absolute',
    width: '56%',
  },
  haloInner: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: radii.pill,
    height: 210,
    left: '22%',
    position: 'absolute',
    top: 56,
    width: '56%',
  },
  haloOuter: {
    borderRadius: radii.pill,
    height: 286,
    left: '10%',
    opacity: 0.72,
    position: 'absolute',
    top: 16,
    width: '80%',
  },
  pedestal: {
    backgroundColor: 'rgba(255,255,255,0.46)',
    borderRadius: radii.pill,
    borderWidth: 5,
    bottom: 8,
    height: 38,
    left: '25%',
    position: 'absolute',
    width: '50%',
  },
  sideWash: {
    borderRadius: radii.pill,
    height: '72%',
    opacity: 0.2,
    position: 'absolute',
    right: '-22%',
    top: '18%',
    transform: [{ rotate: '-14deg' }],
    width: '70%',
  },
  layer: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  sparkle: { color: colors.brandHighlight, fontWeight: '900', position: 'absolute' },
  sparkleLeft: { fontSize: 24, left: 32, top: 42 },
  sparkleRight: { color: colors.brandSecondary, fontSize: 22, right: 34, top: 146 },
  sparkleTop: { color: colors.white, fontSize: 30, right: 68, top: 32 },
  sparkleBottom: { bottom: 72, color: colors.white, fontSize: 18, left: 58 },
  screenBackdrop: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  screenBottomWash: {
    borderRadius: radii.pill,
    bottom: '-12%',
    height: '54%',
    left: '-18%',
    opacity: 0.4,
    position: 'absolute',
    transform: [{ rotate: '8deg' }],
    width: '138%',
  },
  screenBubble: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.58)',
    borderRadius: radii.pill,
    borderWidth: 2,
    position: 'absolute',
  },
  screenBubbleOne: { height: 38, right: 24, top: '29%', width: 38 },
  screenBubbleTwo: { bottom: '22%', height: 22, left: 28, width: 22 },
  screenCloud: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderRadius: radii.pill,
    height: 64,
    position: 'absolute',
    width: 180,
  },
  screenCloudLeft: { left: -64, top: '17%', transform: [{ rotate: '-6deg' }] },
  screenCloudRight: { right: -72, top: '42%', transform: [{ rotate: '7deg' }] },
  screenGlow: {
    borderRadius: radii.pill,
    height: 430,
    left: '8%',
    opacity: 0.32,
    position: 'absolute',
    top: '18%',
    width: '84%',
  },
  screenSparkle: { color: 'rgba(255,255,255,0.78)', fontWeight: '900', position: 'absolute' },
  screenSparkleOne: { fontSize: 28, left: 24, top: '10%' },
  screenSparkleThree: { fontSize: 34, right: '28%', top: '14%' },
  screenSparkleTwo: { bottom: '16%', fontSize: 24, right: 34 },
  screenTopWash: {
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180,
    height: '42%',
    left: 0,
    opacity: 0.5,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  topWash: {
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 100,
    height: '46%',
    left: 0,
    opacity: 0.42,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
