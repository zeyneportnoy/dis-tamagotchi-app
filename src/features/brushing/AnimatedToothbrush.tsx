import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import type { CharacterGrowthStage } from '@/domain/rewards';

import { brushPathFor } from './brushMotion';

type Props = Readonly<{
  characterKey: StarterAvatarKey;
  growthStage: CharacterGrowthStage;
  progress: number;
  segmentIndex: number;
}>;

export function AnimatedToothbrush({ characterKey, growthStage, progress, segmentIndex }: Props) {
  const [stroke] = useState(() => new Animated.Value(0));
  const [pathVariant, setPathVariant] = useState(0);
  const points = brushPathFor(characterKey, growthStage, pathVariant + segmentIndex);

  useEffect(() => {
    stroke.setValue(0);
    const movement = Animated.timing(stroke, {
      duration: 2900,
      easing: Easing.inOut(Easing.sin),
      toValue: 1,
      useNativeDriver: true,
    });
    movement.start(({ finished }) => {
      if (finished) setPathVariant((current) => (current + 1) % 3);
    });
    return () => movement.stop();
  }, [pathVariant, segmentIndex, stroke]);

  return (
    <View pointerEvents="none" style={styles.animation} testID="animated-toothbrush">
      <Animated.View
        style={[
          styles.path,
          {
            transform: [
              {
                translateX: stroke.interpolate({
                  inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                  outputRange: points.map(({ x }) => x - 94),
                }),
              },
              {
                translateY: stroke.interpolate({
                  inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                  outputRange: points.map(({ y }) => y + 6),
                }),
              },
              {
                rotate: stroke.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: ['-14deg', '-5deg', '-11deg', '2deg', '-14deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.foam,
            {
              opacity: stroke.interpolate({
                inputRange: [0, 0.35, 0.7, 1],
                outputRange: [0.48, 1, 0.66, 0.48],
              }),
              transform: [
                {
                  translateY: stroke.interpolate({ inputRange: [0, 1], outputRange: [2, -9] }),
                },
                {
                  scale: stroke.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.8, 1.12, 0.8],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.foamBubble, styles.foamOne]} />
          <View style={[styles.foamBubble, styles.foamTwo]} />
          <View style={[styles.foamBubble, styles.foamThree]} />
          <View style={[styles.foamBubble, styles.foamFour]} />
        </Animated.View>
        <View style={styles.toothbrush}>
          <View style={styles.handle}>
            <View style={styles.grip} />
          </View>
          <View style={styles.neck} />
          <View style={styles.head}>
            <View style={styles.bristleRow}>
              <View style={styles.bristle} />
              <View style={styles.bristle} />
              <View style={styles.bristle} />
              <View style={styles.bristle} />
            </View>
          </View>
        </View>
      </Animated.View>
      <View style={[styles.cleanShine, { opacity: 0.15 + progress * 0.85 }]}>
        <Text style={styles.cleanShineText}>✦</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  animation: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 5,
  },
  bristle: { backgroundColor: '#FFFFFF', borderRadius: 2, height: 9, width: 3 },
  bristleRow: { flexDirection: 'row', gap: 2, position: 'absolute', right: 3, top: -7 },
  cleanShine: { position: 'absolute', right: 22, top: 28 },
  cleanShineText: { color: '#FFD166', fontSize: 32 },
  foam: { height: 34, left: 78, position: 'absolute', top: -15, width: 34 },
  foamBubble: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: '#D7F8F4',
    borderRadius: 20,
    borderWidth: 2,
    position: 'absolute',
  },
  foamFour: { height: 10, left: 25, top: 18, width: 10 },
  foamOne: { height: 18, left: 12, top: 12, width: 18 },
  foamThree: { height: 12, left: 22, top: 0, width: 12 },
  foamTwo: { height: 14, left: 2, top: 6, width: 14 },
  grip: {
    backgroundColor: '#7256CF',
    borderRadius: 6,
    height: 7,
    marginLeft: 9,
    marginTop: 4,
    width: 39,
  },
  handle: {
    backgroundColor: '#42D6C5',
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 13,
    borderTopLeftRadius: 13,
    borderWidth: 3,
    height: 22,
    width: 60,
  },
  head: {
    backgroundColor: '#FF6B81',
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 3,
    height: 20,
    width: 26,
  },
  neck: { backgroundColor: '#42D6C5', height: 10, width: 18 },
  path: { left: 0, position: 'absolute', top: 0 },
  toothbrush: { alignItems: 'center', flexDirection: 'row' },
});
