import { router, useNavigation } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutRectangle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { getChildExperienceUseCases } from '@/application/child';
import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import {
  Button,
  ErrorState,
  LoadingState,
  Screen,
  Text,
  colors,
  radii,
  spacing,
  typography,
} from '@/design-system';
import {
  BRUSHING_SEGMENT_COUNT,
  BRUSHING_TOTAL_SECONDS,
  getBrushingTimerSnapshot,
  pauseBrushingTimer,
  resumeBrushingTimer,
  startBrushingTimer,
  type BrushingTimerState,
} from '@/domain/brushing';
import {
  CharacterAvatar,
  characterSafeViewport,
  evolutionSequence,
  sceneBackgroundForCharacter,
} from '@/features/character';
import { useAuth } from '@/features/auth';
import {
  brushPathFor,
  brushingVoiceCues,
  chooseCompletionJingleIndex,
  completionJingles,
  completionRewardPresentation,
  growthCompletionMessageKey,
  getBrushingVoiceCue,
  getBrushingVoiceProfile,
  getCachedPersonalizedVoiceCue,
  getNicknamePersonalizationEnabled,
  nextAlignedTickBoundary,
  nextCompletionMessageKey,
  personalizedVoiceCueIndexes,
  shouldPlayVoiceCue,
  shouldEmitAlignedTick,
  warmPersonalizedVoiceCue,
  type BrushingVoiceProfile,
  type PersonalizedVoiceCueIndex,
} from '@/features/brushing';
import {
  characterGrowthStageNames,
  effectiveBrushKey,
  growthProgressForXp,
  growthStageForXp,
  type BrushingRewardResult,
} from '@/domain/rewards';
import { loadCustomizationState } from '@/features/customization';
import type { ProfileProgress } from '@/domain/family';

const regionKeys = ['rightUpper', 'leftUpper', 'rightLower', 'leftLower'] as const;
type BrushingRegion = (typeof regionKeys)[number];

const brushImageCentre = { x: 36, y: 64 } as const;
const brushImageBristlePoint = { x: 29.5, y: 19 } as const;
const brushImageRotationDegrees = -12;
const brushRotationDegrees = [76, 67, 73, 60, 76] as const;
const brushBristleAnchor = { x: 71, y: 93 } as const;
const brushContactInset = { x: 3, y: 5 } as const;
const brushingBrushSources: Readonly<Record<string, ImageSourcePropType>> = {
  'classic-brush': require('../assets/rewards/brushes/brushing/classic-brush-brushing.png'),
  'rainbow-brush': require('../assets/rewards/brushes/brushing/rainbow-brush-brushing.png'),
  'star-brush': require('../assets/rewards/brushes/brushing/star-brush-brushing.png'),
  'mini-cape': require('../assets/rewards/brushes/brushing/mini-cape-brushing.png'),
  'dino-brush': require('../assets/rewards/brushes/brushing/dino-brush-brushing.png'),
  'pink-brush': require('../assets/rewards/brushes/brushing/pink-brush-brushing.png'),
  'space-brush': require('../assets/rewards/brushes/brushing/space-brush-brushing.png'),
  'heart-brush': require('../assets/rewards/brushes/brushing/heart-brush-brushing.png'),
};
const defaultBrushingBrushSource: ImageSourcePropType = require('../assets/rewards/brushes/brushing/classic-brush-brushing.png');

function brushingBrushImageSource(brushKey: string | undefined): ImageSourcePropType {
  return (brushKey ? brushingBrushSources[brushKey] : undefined) ?? defaultBrushingBrushSource;
}

function ActiveBrushingKeepAwake() {
  useKeepAwake('denthero-active-brushing-session');
  return null;
}

function rotatePoint(
  point: Readonly<{ x: number; y: number }>,
  centre: Readonly<{ x: number; y: number }>,
  degrees: number,
): Readonly<{ x: number; y: number }> {
  const radians = (degrees * Math.PI) / 180;
  const deltaX = point.x - centre.x;
  const deltaY = point.y - centre.y;
  return {
    x: centre.x + deltaX * Math.cos(radians) - deltaY * Math.sin(radians),
    y: centre.y + deltaX * Math.sin(radians) + deltaY * Math.cos(radians),
  };
}

function brushRotationAt(progress: number): number {
  const lastIndex = brushRotationDegrees.length - 1;
  const scaled = Math.max(0, Math.min(1, progress)) * lastIndex;
  const fromIndex = Math.min(Math.floor(scaled), lastIndex - 1);
  const ratio = scaled - fromIndex;
  const from = brushRotationDegrees[fromIndex] ?? brushRotationDegrees[0];
  const to = brushRotationDegrees[fromIndex + 1] ?? from;
  return from + (to - from) * ratio;
}

function SmileQuadrant({ activeRegion }: { activeRegion: BrushingRegion }) {
  return (
    <View style={styles.smileMap} testID={`smile-quadrant-${activeRegion}`}>
      <Image
        resizeMode="contain"
        source={require('../assets/brushing/quadrant-mouth.png')}
        style={styles.smileMapImage}
      />
      <View
        testID={`quadrant-${activeRegion}`}
        style={[
          styles.smileActiveOverlay,
          activeRegion === 'rightUpper' && styles.smileActiveRightUpper,
          activeRegion === 'leftUpper' && styles.smileActiveLeftUpper,
          activeRegion === 'rightLower' && styles.smileActiveRightLower,
          activeRegion === 'leftLower' && styles.smileActiveLeftLower,
        ]}
      />
    </View>
  );
}

type FoamBubbleConfig = {
  delay: number;
  duration: number;
  dx: number;
  dy: number;
  left: number;
  pop: number;
  size: number;
  top: number;
};

// Each bubble is born near the bristle tip, sprays off in its own direction, swells,
// drifts up and pops — on its own irregular clock — so the foam churns like a real
// brushing froth instead of pulsing in lockstep.
const foamBubbleConfigs: readonly FoamBubbleConfig[] = [
  { delay: 0, duration: 760, dx: -30, dy: -34, left: 30, pop: 1.5, size: 14, top: 40 },
  { delay: 160, duration: 1120, dx: 28, dy: -20, left: 34, pop: 1.25, size: 30, top: 44 },
  { delay: 90, duration: 620, dx: 12, dy: -40, left: 38, pop: 1.55, size: 9, top: 38 },
  { delay: 420, duration: 960, dx: -40, dy: -14, left: 32, pop: 1.3, size: 22, top: 42 },
  { delay: 300, duration: 1320, dx: 40, dy: -30, left: 36, pop: 1.2, size: 36, top: 40 },
  { delay: 560, duration: 700, dx: -14, dy: -46, left: 34, pop: 1.6, size: 11, top: 36 },
  { delay: 240, duration: 880, dx: 20, dy: -10, left: 40, pop: 1.35, size: 17, top: 46 },
  { delay: 680, duration: 1180, dx: -34, dy: -26, left: 30, pop: 1.22, size: 32, top: 42 },
  { delay: 130, duration: 540, dx: 6, dy: -24, left: 36, pop: 1.65, size: 7, top: 40 },
  { delay: 470, duration: 820, dx: 32, dy: -38, left: 38, pop: 1.42, size: 15, top: 38 },
  { delay: 360, duration: 1040, dx: -24, dy: -8, left: 32, pop: 1.28, size: 25, top: 48 },
  { delay: 610, duration: 680, dx: 16, dy: -48, left: 36, pop: 1.55, size: 10, top: 34 },
  { delay: 200, duration: 1000, dx: -8, dy: -30, left: 35, pop: 1.32, size: 20, top: 41 },
  { delay: 520, duration: 900, dx: 36, dy: -16, left: 37, pop: 1.24, size: 13, top: 45 },
  { delay: 340, duration: 640, dx: -20, dy: -44, left: 33, pop: 1.58, size: 8, top: 37 },
];

function FoamBubble({ config, paused }: { config: FoamBubbleConfig; paused: boolean }) {
  const [life] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (paused) {
      life.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(config.delay),
        Animated.timing(life, {
          duration: config.duration,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(life, { duration: 1, toValue: 0, useNativeDriver: true }),
        Animated.delay(config.duration * 0.35),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [config.delay, config.duration, life, paused]);

  return (
    <Animated.View
      style={[
        styles.foamBubble,
        {
          height: config.size,
          left: config.left,
          top: config.top,
          width: config.size,
          opacity: life.interpolate({
            inputRange: [0, 0.12, 0.7, 1],
            outputRange: [0, 1, 0.9, 0],
          }),
          transform: [
            {
              translateX: life.interpolate({ inputRange: [0, 1], outputRange: [0, config.dx] }),
            },
            {
              translateY: life.interpolate({
                inputRange: [0, 1],
                outputRange: [0, config.dy - 10],
              }),
            },
            {
              scale: life.interpolate({
                inputRange: [0, 0.3, 0.8, 1],
                outputRange: [0.1, config.pop, config.pop * 0.85, 0.35],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function AnimatedToothbrush({
  brushKey,
  characterKey,
  growthStage,
  paused,
  progress,
  segmentIndex,
  surfaceCentre,
}: {
  brushKey?: string;
  characterKey: ChildProfileViewModel['avatarId'];
  growthStage: ReturnType<typeof growthStageForXp>;
  paused: boolean;
  progress: number;
  segmentIndex: number;
  surfaceCentre?: Readonly<{ x: number; y: number }>;
}) {
  const [stroke] = useState(() => new Animated.Value(0));
  const [pathVariant, setPathVariant] = useState(0);
  const strokeProgress = useRef(0);
  const routeKey = `${segmentIndex}:${pathVariant}`;
  const activeRouteKey = useRef(routeKey);
  const points = brushPathFor(characterKey, growthStage, pathVariant, segmentIndex, surfaceCentre);
  const motionInputRange = points.map((_, index) => index / (points.length - 1));
  const imageBristlePoint = rotatePoint(
    brushImageBristlePoint,
    brushImageCentre,
    brushImageRotationDegrees,
  );
  const renderedBristlePoints = motionInputRange.map((pathProgress) =>
    rotatePoint(imageBristlePoint, brushBristleAnchor, brushRotationAt(pathProgress)),
  );

  useEffect(() => {
    if (activeRouteKey.current !== routeKey) {
      activeRouteKey.current = routeKey;
      strokeProgress.current = 0;
      stroke.setValue(0);
    }
    if (paused) {
      stroke.stopAnimation((value) => {
        strokeProgress.current = value;
      });
      return;
    }
    const movement = Animated.timing(stroke, {
      duration: Math.max(1, 2900 * (1 - strokeProgress.current)),
      easing: Easing.inOut(Easing.sin),
      toValue: 1,
      useNativeDriver: true,
    });
    movement.start(({ finished }) => {
      if (finished) {
        strokeProgress.current = 0;
        setPathVariant((current) => (current + 1) % 3);
      }
    });
    return () => {
      stroke.stopAnimation((value) => {
        strokeProgress.current = value;
      });
    };
  }, [paused, routeKey, stroke]);

  return (
    <View pointerEvents="none" style={styles.brushAnimation} testID="animated-toothbrush">
      <Animated.View
        style={[
          styles.foamLayer,
          {
            opacity: stroke.interpolate({
              inputRange: [0, 0.35, 0.7, 1],
              outputRange: [0.9, 1, 0.95, 0.9],
            }),
            transform: [
              {
                translateX: stroke.interpolate({
                  inputRange: motionInputRange,
                  outputRange: points.map(({ x }) => x - 35),
                }),
              },
              {
                translateY: stroke.interpolate({
                  inputRange: motionInputRange,
                  outputRange: points.map(({ y }) => y - 40),
                }),
              },
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
        {foamBubbleConfigs.map((config, index) => (
          <FoamBubble config={config} key={index} paused={paused} />
        ))}
      </Animated.View>
      <Animated.View
        testID="brushing-brush-anchor"
        style={[
          styles.brushPath,
          {
            transformOrigin: [brushBristleAnchor.x, brushBristleAnchor.y, 0],
            transform: [
              {
                translateX: stroke.interpolate({
                  inputRange: motionInputRange,
                  outputRange: points.map(
                    ({ x }, index) =>
                      x -
                      (renderedBristlePoints[index]?.x ?? brushBristleAnchor.x) +
                      brushContactInset.x,
                  ),
                }),
              },
              {
                translateY: stroke.interpolate({
                  inputRange: motionInputRange,
                  outputRange: points.map(
                    ({ y }, index) =>
                      y -
                      (renderedBristlePoints[index]?.y ?? brushBristleAnchor.y) +
                      brushContactInset.y,
                  ),
                }),
              },
              {
                rotate: stroke.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: brushRotationDegrees.map((degrees) => `${degrees}deg`),
                }),
              },
            ],
          },
        ]}
      >
        <Image
          resizeMode="contain"
          source={brushingBrushImageSource(brushKey)}
          style={styles.brushImage}
          testID="brushing-brush-image"
        />
      </Animated.View>
      <View style={[styles.cleanShine, { opacity: 0.15 + progress * 0.85 }]}>
        <Text style={styles.cleanShineText}>✦</Text>
      </View>
    </View>
  );
}

const celebrationParticles = [
  { color: '#FFD166', left: '8%', top: '14%' },
  { color: '#FF6B81', left: '23%', top: '7%' },
  { color: '#42D6C5', left: '40%', top: '13%' },
  { color: '#FFFFFF', left: '57%', top: '6%' },
  { color: '#FF9FC6', left: '73%', top: '15%' },
  { color: '#FFD166', left: '87%', top: '8%' },
  { color: '#42D6C5', left: '14%', top: '45%' },
  { color: '#FFFFFF', left: '82%', top: '42%' },
] as const;

function CompletionCelebration({ stage }: { stage: ReturnType<typeof growthStageForXp> }) {
  const [burst] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(burst, {
          duration: stage >= 3 ? 850 : 1100,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(burst, { duration: 280, toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [burst, stage]);

  return (
    <View
      pointerEvents="none"
      style={styles.celebrationEffects}
      testID={`celebration-stage-${stage}`}
    >
      {celebrationParticles.map((particle, index) => (
        <Animated.View
          key={`${particle.left}-${particle.top}`}
          style={[
            styles.confettiParticle,
            particle,
            index % 2 === 0 ? styles.confettiRound : styles.confettiDiamond,
            {
              opacity: burst.interpolate({
                inputRange: [0, 0.15, 0.82, 1],
                outputRange: [0.35, 1, 0.8, 0.25],
              }),
              transform: [
                {
                  translateY: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 18 + (index % 3) * 8],
                  }),
                },
                {
                  rotate: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', index % 2 === 0 ? '150deg' : '-150deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function ResultGrowth({
  profile,
  result,
}: {
  profile: ChildProfileViewModel;
  result: BrushingRewardResult;
}) {
  const { t } = useTranslation();
  const [animation] = useState(() => new Animated.Value(0));
  const [celebrationMotion] = useState(() => new Animated.Value(0));
  const [evolutionReveal] = useState(() => new Animated.Value(1));
  const [evolutionFrame, setEvolutionFrame] = useState(0);
  const previousXp = Math.max(0, result.progress.totalXp - result.xpGranted);
  const previousStage = growthStageForXp(previousXp);
  const growth = growthProgressForXp(result.progress.totalXp);
  const stage = growth.currentStage;
  const target = growth.targetXp;
  const ratio = growth.ratio;
  const evolutionFrames = evolutionSequence(previousStage, stage);
  const evolution = evolutionFrames[Math.min(evolutionFrame, evolutionFrames.length - 1)];
  const evolutionFrameCount = evolutionFrames.length;
  const completionMood =
    result.dailyProgress.fullDayCompleted ||
    result.streakAdvanced ||
    result.unlockedItemKey !== null ||
    previousStage < stage
      ? 'proud'
      : 'happy';

  useEffect(() => {
    Animated.timing(animation, { duration: 850, toValue: ratio, useNativeDriver: false }).start();
  }, [animation, ratio]);

  useEffect(() => {
    if (evolutionFrameCount === 1) return;
    const timers = Array.from({ length: evolutionFrameCount - 1 }, (_, index) =>
      setTimeout(() => setEvolutionFrame(index + 1), 1050 * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [evolutionFrameCount, previousStage, stage]);

  useEffect(() => {
    evolutionReveal.setValue(0);
    Animated.timing(evolutionReveal, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [evolutionFrame, evolutionReveal]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(celebrationMotion, {
          duration: stage <= 1 ? 360 : 470,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(celebrationMotion, {
          duration: stage <= 1 ? 360 : 470,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [celebrationMotion, stage]);

  return (
    <>
      <Animated.View
        style={[
          styles.resultCharacter,
          {
            opacity: evolutionReveal,
            transform: [
              {
                translateY: celebrationMotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: stage <= 1 ? [2, -3] : [2, stage === 4 ? -18 : -12],
                }),
              },
              {
                rotate: celebrationMotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: stage <= 1 ? ['-4deg', '4deg'] : ['-1deg', '1deg'],
                }),
              },
              {
                scale: celebrationMotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, stage === 4 ? 1.08 : stage >= 2 ? 1.04 : 1.015],
                }),
              },
              {
                scale: evolutionReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      >
        <CharacterAvatar
          characterKey={profile.avatarId}
          growthStage={evolution?.growthStage ?? stage}
          mood={completionMood}
          phase={evolution?.phase ?? 'resting'}
          size="hero"
          surface="plain"
        />
      </Animated.View>
      <View style={styles.resultGrowth}>
        <View style={styles.resultXpTrack}>
          <Animated.View
            style={[
              styles.resultXpFill,
              { width: animation.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
        <View style={styles.resultStageInfo}>
          <Text style={styles.resultCurrentStage}>
            {t('growth.currentStage', {
              stage: t(`growth.stages.${characterGrowthStageNames[stage]}`),
            })}
          </Text>
          {growth.nextStage === null ? null : (
            <Text style={styles.resultNextStage}>
              {t('growth.nextStage', {
                stage: t(`growth.stages.${characterGrowthStageNames[growth.nextStage]}`),
              })}
            </Text>
          )}
        </View>
        <Text style={styles.resultXp}>
          {t('brushing.rewardProgress', { current: result.progress.totalXp, target })}
        </Text>
        <Text style={styles.remainingXp}>
          {growth.isFinalStage
            ? t('growth.finalStage')
            : t('growth.remainingXp', {
                count: growth.remainingXp,
                stage: t(`growth.stages.${characterGrowthStageNames[growth.nextStage!]}`),
              })}
        </Text>
        <Text style={[styles.growthMessage, stage > previousStage && styles.growthMessageUnlocked]}>
          {t(growthCompletionMessageKey(previousXp, result.progress.totalXp))}
        </Text>
      </View>
    </>
  );
}

export default function BrushingScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigation = useNavigation();
  const startedAt = useRef<string | null>(null);
  const sessionId = useRef(randomUUID());
  const completionStarted = useRef(false);
  const completionJinglePlayed = useRef(false);
  const allowExit = useRef(false);
  const exitPromptOpen = useRef(false);
  const exitInProgress = useRef(false);
  const lastAnnouncedSegment = useRef(-1);
  const lastTickAtMonotonicMs = useRef<number | null>(null);
  const nextTickPlayer = useRef<0 | 1>(0);
  const voiceSpeaking = useRef(false);
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [equippedBrushKey, setEquippedBrushKey] = useState<string | undefined>(undefined);
  const [initialProgress, setInitialProgress] = useState<ProfileProgress | null>(null);
  const [timer, setTimer] = useState<BrushingTimerState | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [exitConfirmation, setExitConfirmation] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const [result, setResult] = useState<BrushingRewardResult | null>(null);
  const [rewardEquipped, setRewardEquipped] = useState(false);
  const [completionMessageKey, setCompletionMessageKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<BrushingVoiceProfile | null>(null);
  const [characterZoneLayout, setCharacterZoneLayout] = useState<LayoutRectangle | null>(null);
  const [characterArtworkLayout, setCharacterArtworkLayout] = useState<LayoutRectangle | null>(
    null,
  );
  const [nicknamePersonalization, setNicknamePersonalization] = useState<boolean | null>(null);
  const [personalizedCueUris, setPersonalizedCueUris] = useState<
    Partial<Record<PersonalizedVoiceCueIndex, string>>
  >({});
  const [completionJingleIndex] = useState(chooseCompletionJingleIndex);
  const completionJingle = useAudioPlayer(completionJingles[completionJingleIndex]?.source);
  const timerTickA = useAudioPlayer(require('../assets/audio/soft-timer-tick.wav'));
  const timerTickB = useAudioPlayer(require('../assets/audio/soft-timer-tick.wav'));
  const gokceRightUpperVoice = useAudioPlayer(brushingVoiceCues.gokce[0].source);
  const gokceLeftUpperVoice = useAudioPlayer(brushingVoiceCues.gokce[1].source);
  const gokceRightLowerVoice = useAudioPlayer(brushingVoiceCues.gokce[2].source);
  const gokceLeftLowerVoice = useAudioPlayer(brushingVoiceCues.gokce[3].source);
  const sametRightUpperVoice = useAudioPlayer(brushingVoiceCues.samet[0].source);
  const sametLeftUpperVoice = useAudioPlayer(brushingVoiceCues.samet[1].source);
  const sametRightLowerVoice = useAudioPlayer(brushingVoiceCues.samet[2].source);
  const sametLeftLowerVoice = useAudioPlayer(brushingVoiceCues.samet[3].source);
  const personalizedVoice = useAudioPlayer(null);
  const snapshot = timer ? getBrushingTimerSnapshot(timer, nowMs) : null;
  const region = regionKeys[snapshot?.segmentIndex ?? 0] ?? regionKeys[0];
  const currentGrowthStage = growthStageForXp(initialProgress?.totalXp ?? 0);
  const largeCharacterViewport = characterSafeViewport.large;
  const characterSurfaceCentre =
    characterZoneLayout && characterArtworkLayout
      ? {
          x:
            characterZoneLayout.x +
            (characterZoneLayout.width - largeCharacterViewport.width) / 2 +
            characterArtworkLayout.x +
            characterArtworkLayout.width / 2,
          y:
            characterZoneLayout.y +
            (characterZoneLayout.height - largeCharacterViewport.height) / 2 +
            characterArtworkLayout.y +
            characterArtworkLayout.height / 2,
        }
      : undefined;

  const pauseSessionAudio = useCallback((): void => {
    timerTickA.pause();
    timerTickB.pause();
    gokceRightUpperVoice.pause();
    gokceLeftUpperVoice.pause();
    gokceRightLowerVoice.pause();
    gokceLeftLowerVoice.pause();
    sametRightUpperVoice.pause();
    sametLeftUpperVoice.pause();
    sametRightLowerVoice.pause();
    sametLeftLowerVoice.pause();
    personalizedVoice.pause();
    voiceSpeaking.current = false;
  }, [
    gokceLeftLowerVoice,
    gokceLeftUpperVoice,
    gokceRightLowerVoice,
    gokceRightUpperVoice,
    personalizedVoice,
    sametLeftLowerVoice,
    sametLeftUpperVoice,
    sametRightLowerVoice,
    sametRightUpperVoice,
    timerTickA,
    timerTickB,
  ]);

  useEffect(() => {
    if (!session?.userId || !profile) return;
    let active = true;
    const cueInput = (cueIndex: PersonalizedVoiceCueIndex) => ({
      childProfileId: profile.id,
      cueIndex,
      nickname: profile.nickname,
      profile: 'gokce' as const,
    });
    void Promise.all([
      getBrushingVoiceProfile(session.userId, profile.id),
      getNicknamePersonalizationEnabled(session.userId, profile.id),
      ...personalizedVoiceCueIndexes.map((cueIndex) =>
        getCachedPersonalizedVoiceCue(cueInput(cueIndex)),
      ),
    ])
      .then(([storedVoiceProfile, personalizationEnabled, rightUpperUri, rightLowerUri]) => {
        if (!active) return;
        setVoiceProfile(storedVoiceProfile);
        setNicknamePersonalization(personalizationEnabled);
        setPersonalizedCueUris({
          ...(rightUpperUri ? { 0: rightUpperUri } : {}),
          ...(rightLowerUri ? { 2: rightLowerUri } : {}),
        });
        if (!personalizationEnabled || storedVoiceProfile !== 'gokce') return;
        personalizedVoiceCueIndexes.forEach((cueIndex) => {
          void warmPersonalizedVoiceCue(cueInput(cueIndex))
            .then((uri) => {
              if (active && uri)
                setPersonalizedCueUris((current) => ({ ...current, [cueIndex]: uri }));
            })
            .catch(() => undefined);
        });
      })
      .catch(() => {
        if (active) {
          setVoiceProfile('gokce');
          setNicknamePersonalization(false);
        }
      });
    return () => {
      active = false;
      voiceSpeaking.current = false;
    };
  }, [profile, session?.userId]);

  useEffect(() => {
    const voicePlayers = [
      gokceRightUpperVoice,
      gokceLeftUpperVoice,
      gokceRightLowerVoice,
      gokceLeftLowerVoice,
      sametRightUpperVoice,
      sametLeftUpperVoice,
      sametRightLowerVoice,
      sametLeftLowerVoice,
      personalizedVoice,
    ];
    const subscriptions = voicePlayers.map((player, index) =>
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish || status.error) {
          voiceSpeaking.current = false;
          if (__DEV__) {
            console.info(`[brushing-voice] ${status.error ? 'error' : 'finished'} player=${index}`);
          }
        }
      }),
    );
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [
    gokceLeftLowerVoice,
    gokceLeftUpperVoice,
    gokceRightLowerVoice,
    gokceRightUpperVoice,
    sametLeftLowerVoice,
    sametLeftUpperVoice,
    sametRightLowerVoice,
    sametRightUpperVoice,
    personalizedVoice,
  ]);

  useEffect(() => {
    const currentSnapshot = snapshot;
    const segmentIndex = currentSnapshot?.segmentIndex;
    if (
      !profile ||
      !currentSnapshot ||
      segmentIndex === undefined ||
      voiceProfile === null ||
      !shouldPlayVoiceCue({
        completed: currentSnapshot.completed,
        lastAnnouncedSegment: lastAnnouncedSegment.current,
        profile: voiceProfile,
        segmentIndex,
      })
    ) {
      return;
    }
    const personalizedUri =
      nicknamePersonalization &&
      voiceProfile === 'gokce' &&
      (segmentIndex === 0 || segmentIndex === 2)
        ? personalizedCueUris[segmentIndex]
        : undefined;
    const voicePlayer = personalizedUri
      ? personalizedVoice
      : voiceProfile === 'gokce'
        ? [gokceRightUpperVoice, gokceLeftUpperVoice, gokceRightLowerVoice, gokceLeftLowerVoice][
            segmentIndex
          ]
        : voiceProfile === 'samet'
          ? [sametRightUpperVoice, sametLeftUpperVoice, sametRightLowerVoice, sametLeftLowerVoice][
              segmentIndex
            ]
          : undefined;
    if (!voicePlayer) return;
    if (personalizedUri) personalizedVoice.replace(personalizedUri);
    lastAnnouncedSegment.current = segmentIndex;
    voiceSpeaking.current = true;
    timerTickA.pause();
    timerTickB.pause();
    if (__DEV__) {
      const cue = getBrushingVoiceCue(voiceProfile, segmentIndex);
      console.info(
        `[brushing-voice] play profile=${voiceProfile} region=${cue?.region ?? 'unknown'} boundary=${cue?.boundarySecond ?? 'unknown'} source=${personalizedUri ? 'personalized-cache' : (cue?.path ?? 'unknown')}`,
      );
    }
    void voicePlayer.seekTo(0).then(() => voicePlayer.play());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, [
    gokceLeftLowerVoice,
    gokceLeftUpperVoice,
    gokceRightLowerVoice,
    gokceRightUpperVoice,
    nicknamePersonalization,
    personalizedCueUris,
    personalizedVoice,
    profile,
    sametLeftLowerVoice,
    sametLeftUpperVoice,
    sametRightLowerVoice,
    sametRightUpperVoice,
    snapshot,
    timerTickA,
    timerTickB,
    voiceProfile,
  ]);

  useEffect(() => {
    if (!timer || timer.status !== 'running' || result) {
      timerTickA.pause();
      timerTickB.pause();
      return;
    }
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextBoundary = (): void => {
      const boundary = nextAlignedTickBoundary({
        nowWallTimeMs: Date.now(),
        pausedDurationMs: timer.pausedDurationMs,
        startedAtMs: timer.startedAtMs,
      });
      const monotonicDeadlineMs = performance.now() + boundary.delayMs;
      timeout = setTimeout(() => {
        if (cancelled) return;
        const firedAtMonotonicMs = performance.now();
        const lateByMs = Math.max(0, firedAtMonotonicMs - monotonicDeadlineMs);
        setNowMs(Date.now());

        if (
          shouldEmitAlignedTick({
            boundarySecond: boundary.boundarySecond,
            lateByMs,
            totalSeconds: BRUSHING_TOTAL_SECONDS,
            voiceGuidanceEnabled: voiceProfile !== null && voiceProfile !== 'off',
            voiceSpeaking: voiceSpeaking.current,
          })
        ) {
          const activePlayer = nextTickPlayer.current === 0 ? timerTickA : timerTickB;
          const standbyPlayer = nextTickPlayer.current === 0 ? timerTickB : timerTickA;
          activePlayer.play();
          standbyPlayer.pause();
          void standbyPlayer.seekTo(0);
          nextTickPlayer.current = nextTickPlayer.current === 0 ? 1 : 0;

          if (__DEV__) {
            const intervalMs =
              lastTickAtMonotonicMs.current === null
                ? null
                : firedAtMonotonicMs - lastTickAtMonotonicMs.current;
            console.info(
              `[brushing-tick] second=${boundary.boundarySecond} at=${firedAtMonotonicMs.toFixed(3)}ms interval=${intervalMs?.toFixed(3) ?? 'first'}ms late=${lateByMs.toFixed(3)}ms`,
            );
            lastTickAtMonotonicMs.current = firedAtMonotonicMs;
          }
        }

        if (boundary.boundarySecond < BRUSHING_TOTAL_SECONDS) scheduleNextBoundary();
      }, boundary.delayMs);
    };

    scheduleNextBoundary();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      // expo-audio can release the native player before this cleanup runs on unmount.
      try {
        timerTickA.pause();
        timerTickB.pause();
      } catch {
        /* player already torn down */
      }
    };
  }, [result, timer, timerTickA, timerTickB, voiceProfile]);

  useEffect(() => {
    if (!profile || voiceProfile === null || nicknamePersonalization === null || startedAt.current)
      return;
    const initialNow = Date.now();
    const sessionStartedAt = new Date(initialNow).toISOString();
    startedAt.current = sessionStartedAt;
    void getChildExperienceUseCases()
      .then((useCases) =>
        useCases.beginBrushingSession(sessionId.current, profile.id, sessionStartedAt),
      )
      .then(() => {
        setTimer(startBrushingTimer(initialNow));
        setNowMs(initialNow);
      })
      .catch(() => setFailed(true));
  }, [nicknamePersonalization, profile, voiceProfile]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (result || allowExit.current) return;
        event.preventDefault();
        if (exitPromptOpen.current) return;
        exitPromptOpen.current = true;
        const current = Date.now();
        setTimer((state) => (state ? pauseBrushingTimer(state, current) : state));
        setNowMs(current);
        pauseSessionAudio();
        setExitConfirmation(true);
      }),
    [navigation, pauseSessionAudio, result],
  );

  useEffect(() => {
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then(async (activeProfile) => {
        if (!activeProfile) return router.replace('/onboarding');
        const childUseCases = await getChildExperienceUseCases();
        const [progress, equippedItems, customization] = await Promise.all([
          childUseCases.getProgress(activeProfile.id),
          childUseCases.getEquippedItems(activeProfile.id),
          __DEV__ ? loadCustomizationState(activeProfile.id) : Promise.resolve(null),
        ]);
        setProfile(activeProfile);
        setInitialProgress(progress);
        const equippedBrush = equippedItems.find((item) => item.slot === 'brush')?.key;
        // In DEV, Collection writes the chosen brush to the developer-equipped override
        // (AsyncStorage) rather than the inventory table, so honor it here too.
        const devBrush = customization?.developerEquipped.brush ?? undefined;
        // If a Mine Puan drop has re-locked the selected brush, use the always-open
        // classic brush instead of an invalid selection.
        setEquippedBrushKey(effectiveBrushKey(devBrush ?? equippedBrush, progress.totalXp));
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 250);
    const subscription = AppState.addEventListener('change', () => setNowMs(Date.now()));
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const sessionStartedAt = startedAt.current;
    if (!snapshot?.completed || !profile || completionStarted.current || !sessionStartedAt) return;
    completionStarted.current = true;
    void getChildExperienceUseCases()
      .then((useCases) =>
        useCases.completeBrushingSession(sessionId.current, profile.id, sessionStartedAt),
      )
      .then(setResult)
      .catch(() => setFailed(true));
  }, [profile, snapshot?.completed]);

  useEffect(() => {
    if (!result || !profile || completionMessageKey) return;
    void nextCompletionMessageKey(profile.ageBand).then(setCompletionMessageKey);
  }, [completionMessageKey, profile, result]);

  useEffect(() => {
    if (!result || completionJinglePlayed.current) return;
    completionJinglePlayed.current = true;
    timerTickA.pause();
    timerTickB.pause();
    gokceRightUpperVoice.pause();
    gokceLeftUpperVoice.pause();
    gokceRightLowerVoice.pause();
    gokceLeftLowerVoice.pause();
    sametRightUpperVoice.pause();
    sametLeftUpperVoice.pause();
    sametRightLowerVoice.pause();
    sametLeftLowerVoice.pause();
    personalizedVoice.pause();
    voiceSpeaking.current = false;
    void completionJingle.seekTo(0).then(() => completionJingle.play());
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [
    completionJingle,
    gokceLeftLowerVoice,
    gokceLeftUpperVoice,
    gokceRightLowerVoice,
    gokceRightUpperVoice,
    personalizedVoice,
    result,
    sametLeftLowerVoice,
    sametLeftUpperVoice,
    sametRightLowerVoice,
    sametRightUpperVoice,
    timerTickA,
    timerTickB,
  ]);

  if (failed) return <ErrorState body={t('brushing.saveError')} />;
  if (!profile || !initialProgress || !timer || !snapshot) {
    return <LoadingState label={t('brushing.loading')} />;
  }

  if (result) {
    const completionStage = growthStageForXp(result.progress.totalXp);
    const rewardPresentation = completionRewardPresentation(
      result.session.period,
      result.xpGranted,
    );
    return (
      <Screen
        style={[
          styles.completionScreen,
          { backgroundColor: sceneBackgroundForCharacter(profile.avatarId) },
        ]}
        testID="brushing-complete-screen"
      >
        <ScrollView
          contentContainerStyle={styles.completionContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.celebrationStage}>
            <CompletionCelebration stage={completionStage} />
            <Text style={styles.confettiLeft}>✦</Text>
            <Text style={styles.confettiRight}>★</Text>
            <ResultGrowth profile={profile} result={result} />
            <View style={styles.celebrationRug} />
          </View>
          <View style={styles.completionCopy}>
            <Text style={styles.centerText} variant="title">
              {t(completionMessageKey ?? 'brushing.completeTitle')}
            </Text>
            <Text style={styles.centerText}>
              {t(
                profile.ageBand === '4_6'
                  ? 'brushing.completeBodyFourSix'
                  : 'brushing.completeBody',
              )}
            </Text>
            {rewardPresentation.kind === 'earned' ? (
              <View style={styles.rewardRow}>
                <View style={styles.rewardChip}>
                  <Text style={styles.rewardValue}>
                    {t('brushing.rewardAmount', { amount: result.xpGranted })}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.noRewardCopy} testID="brushing-no-reward-copy">
                <Text style={styles.noRewardTitle}>{t(rewardPresentation.titleKey)}</Text>
                <Text style={styles.centerText}>{t(rewardPresentation.detailKey)}</Text>
              </View>
            )}
            <Text style={styles.centerText}>
              {t('brushing.dailyResult', {
                evening: result.dailyProgress.eveningCompleted ? '✓' : '•',
                morning: result.dailyProgress.morningCompleted ? '✓' : '•',
              })}
            </Text>
            {result.streakAdvanced ? (
              <Text style={styles.streakResult}>
                {t('brushing.streakResult', { count: result.dailyProgress.streakAfterDay })}
              </Text>
            ) : null}
            {result.unlockedItemKey ? (
              <View style={styles.unlockCard}>
                <Text style={styles.unlockResult}>{t('brushing.newReward')}</Text>
                <Text style={styles.rewardItemName}>
                  {t(`rewards.items.${result.unlockedItemKey}`)}
                </Text>
                <View style={styles.rewardActions}>
                  <Button
                    disabled={rewardEquipped}
                    label={t(rewardEquipped ? 'brushing.equipped' : 'brushing.equipNow')}
                    onPress={() => {
                      void getChildExperienceUseCases()
                        .then((useCases) => useCases.equipItem(profile.id, result.unlockedItemKey!))
                        .then(() => setRewardEquipped(true));
                    }}
                  />
                  <Button
                    label={t('brushing.openCollection')}
                    onPress={() => {
                      allowExit.current = true;
                      router.replace('/(child)/collection');
                    }}
                    variant="secondary"
                  />
                </View>
              </View>
            ) : null}
          </View>
          <Button
            label={t('brushing.home')}
            onPress={() => {
              allowExit.current = true;
              router.replace('/(child)');
            }}
          />
        </ScrollView>
      </Screen>
    );
  }

  const paused = timer.status === 'paused';
  const requestExit = (): void => {
    if (exitPromptOpen.current || exitInProgress.current) return;
    exitPromptOpen.current = true;
    const current = Date.now();
    setTimer((state) => (state ? pauseBrushingTimer(state, current) : state));
    setNowMs(current);
    pauseSessionAudio();
    setExitConfirmation(true);
  };

  const continueBrushing = (): void => {
    if (exitInProgress.current) return;
    const current = Date.now();
    exitPromptOpen.current = false;
    setExitConfirmation(false);
    setTimer((state) => (state ? resumeBrushingTimer(state, current) : state));
    setNowMs(current);
  };

  const confirmExit = async (): Promise<void> => {
    if (exitInProgress.current) return;
    exitInProgress.current = true;
    setExitSaving(true);
    pauseSessionAudio();
    try {
      const sessionStartedAt = startedAt.current;
      if (sessionStartedAt) {
        const elapsedSeconds = Math.min(
          BRUSHING_TOTAL_SECONDS - 1,
          Math.max(0, Math.floor(snapshot.elapsedSeconds)),
        );
        const useCases = await getChildExperienceUseCases();
        await useCases.abandonBrushingSession(
          sessionId.current,
          profile.id,
          sessionStartedAt,
          elapsedSeconds,
        );
      }
      allowExit.current = true;
      setExitConfirmation(false);
      router.replace('/(child)');
    } catch {
      exitInProgress.current = false;
      exitPromptOpen.current = false;
      setExitSaving(false);
      setFailed(true);
    }
  };
  return (
    <Screen
      style={[styles.screen, { backgroundColor: sceneBackgroundForCharacter(profile.avatarId) }]}
      testID="brushing-session-screen"
    >
      <ActiveBrushingKeepAwake />
      <Pressable
        accessibilityLabel={t('brushing.exit')}
        accessibilityRole="button"
        hitSlop={8}
        onPress={requestExit}
        style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}
        testID="brushing-exit-button"
      >
        <Text style={styles.exitIcon}>×</Text>
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.sessionContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{t('brushing.title')}</Text>
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View>
              <Text style={styles.regionTitle}>{t(`brushing.regions.${region}`)}</Text>
              <Text style={styles.progress}>
                {t('brushing.progress', {
                  current: snapshot.segmentIndex + 1,
                  total: BRUSHING_SEGMENT_COUNT,
                })}
              </Text>
            </View>
            <View
              accessible
              accessibilityLabel={t('brushing.totalRemaining', {
                seconds: snapshot.remainingSeconds,
              })}
              style={styles.timerBadge}
            >
              <Text style={styles.timerText}>{snapshot.segmentRemainingSeconds}</Text>
              <Text style={styles.secondsLabel}>sn</Text>
            </View>
          </View>
          <View
            accessibilityLabel={t('brushing.progress', {
              current: snapshot.segmentIndex + 1,
              total: BRUSHING_SEGMENT_COUNT,
            })}
            accessible
            style={styles.segmentTrack}
          >
            {regionKeys.map((key, index) => (
              <View
                key={key}
                style={[styles.segment, index <= snapshot.segmentIndex && styles.segmentActive]}
              />
            ))}
          </View>
          <View style={styles.brushingStage}>
            <Text style={styles.bubbleOne}>✦</Text>
            <Text style={styles.bubbleTwo}>✦</Text>
            <View style={styles.stageRug} />
            <View
              onLayout={({ nativeEvent }) => setCharacterZoneLayout(nativeEvent.layout)}
              style={styles.brushingCharacterZone}
              testID="brushing-character-layer"
            >
              <CharacterAvatar
                characterKey={profile.avatarId}
                growthStage={growthStageForXp(initialProgress.totalXp)}
                mood={paused ? 'waiting' : 'energetic'}
                onArtworkLayout={setCharacterArtworkLayout}
                phase="resting"
                size="large"
                surface="plain"
              />
            </View>
            <AnimatedToothbrush
              brushKey={equippedBrushKey}
              characterKey={profile.avatarId}
              growthStage={currentGrowthStage}
              paused={paused}
              progress={Math.max(0, Math.min(1, snapshot.elapsedSeconds / 120))}
              segmentIndex={snapshot.segmentIndex}
              surfaceCentre={characterSurfaceCentre}
            />
            <View accessibilityLabel={t(`brushing.regions.${region}`)} style={styles.mouthMap}>
              <SmileQuadrant activeRegion={region} />
            </View>
          </View>
          <Text style={styles.instruction}>
            {t(profile.ageBand === '4_6' ? 'brushing.helperFourSix' : 'brushing.helperSevenEleven')}
          </Text>
          <Text style={styles.totalRemaining}>
            {t('brushing.totalRemainingShort', { seconds: snapshot.remainingSeconds })}
          </Text>
        </View>
        {paused ? (
          <View style={styles.controls} testID="pause-controls">
            <Button
              label={t('brushing.resume')}
              onPress={() => {
                const current = Date.now();
                setTimer((state) => (state ? resumeBrushingTimer(state, current) : state));
                setNowMs(current);
              }}
            />
            <Button
              label={t('brushing.finish')}
              onPress={() => setExitConfirmation(true)}
              variant="secondary"
            />
          </View>
        ) : (
          <Button
            label={t('brushing.pause')}
            onPress={() => {
              const current = Date.now();
              setTimer((state) => (state ? pauseBrushingTimer(state, current) : state));
              setNowMs(current);
            }}
            variant="secondary"
          />
        )}
      </ScrollView>
      {exitConfirmation ? (
        <View accessibilityViewIsModal style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.dialog} testID="exit-confirmation">
            <View style={styles.dialogCharacterHero} testID="exit-character-sad">
              <View style={styles.dialogCharacterScale}>
                <CharacterAvatar
                  characterKey={profile.avatarId}
                  growthStage={currentGrowthStage}
                  mood="sad"
                  size="large"
                  surface="plain"
                />
              </View>
            </View>
            <Text style={styles.centerText} variant="title">
              {t('brushing.exitQuestion')}
            </Text>
            <Text style={styles.dialogDescription}>{t('brushing.exitDescription')}</Text>
            <Button disabled={exitSaving} label={t('brushing.stay')} onPress={continueBrushing} />
            <Button
              disabled={exitSaving}
              label={t('brushing.exit')}
              onPress={() => void confirmExit()}
              variant="secondary"
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brushAnimation: {
    height: 190,
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    top: 0,
    width: 195,
    zIndex: 5,
  },
  brushImage: {
    height: 128,
    transform: [{ rotate: `${brushImageRotationDegrees}deg` }],
    width: 72,
  },
  brushPath: { height: 128, left: 0, position: 'absolute', top: 0, width: 72 },
  bubbleOne: {
    color: colors.brandHighlight,
    fontSize: 24,
    left: spacing.md,
    position: 'absolute',
    top: spacing.md,
  },
  bubbleTwo: {
    color: colors.brandSecondary,
    fontSize: 20,
    position: 'absolute',
    right: spacing.lg,
    top: 52,
  },
  brushingStage: {
    backgroundColor: '#F9D7E5',
    borderRadius: 28,
    height: 300,
    overflow: 'visible',
    position: 'relative',
  },
  brushingCharacterZone: {
    alignItems: 'center',
    bottom: 8,
    justifyContent: 'center',
    left: 8,
    opacity: 1,
    overflow: 'visible',
    position: 'absolute',
    top: 8,
    width: 250,
    zIndex: 3,
  },
  cleanShine: { position: 'absolute', right: 22, top: 28 },
  cleanShineText: { color: '#FFD166', fontSize: 32 },
  celebrationRug: {
    backgroundColor: '#D783C1',
    borderRadius: radii.pill,
    height: 28,
    position: 'absolute',
    top: 250,
    width: 180,
  },
  celebrationEffects: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  celebrationStage: {
    alignItems: 'center',
    backgroundColor: '#D9C7FF',
    borderRadius: 34,
    gap: spacing.md,
    minHeight: 590,
    overflow: 'hidden',
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
  },
  centerText: { textAlign: 'center' },
  completionContent: { gap: spacing.lg, paddingBottom: spacing.xl },
  completionCopy: { gap: spacing.sm, width: '100%' },
  completionScreen: { justifyContent: 'flex-start' },
  confettiDiamond: { borderRadius: 2 },
  confettiLeft: {
    color: colors.brandHighlight,
    fontSize: 34,
    left: spacing.lg,
    position: 'absolute',
    top: spacing.lg,
  },
  confettiRight: {
    color: colors.brandSecondary,
    fontSize: 32,
    position: 'absolute',
    right: spacing.lg,
    top: 72,
  },
  confettiParticle: { height: 11, position: 'absolute', width: 11 },
  confettiRound: { borderRadius: radii.pill },
  noRewardCopy: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  noRewardTitle: { fontWeight: '900', textAlign: 'center' },
  controls: { gap: spacing.md },
  dialog: {
    backgroundColor: colors.white,
    borderRadius: 32,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  dialogCharacterHero: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 190,
    justifyContent: 'center',
    overflow: 'visible',
    width: 220,
  },
  dialogCharacterScale: { transform: [{ scale: 0.68 }] },
  dialogDescription: { color: colors.textPrimary, opacity: 0.72, textAlign: 'center' },
  eyebrow: {
    backgroundColor: '#F0EAFE',
    borderRadius: radii.pill,
    color: colors.brandPrimary,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  exitButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    left: spacing.lg,
    position: 'absolute',
    top: spacing.xl + spacing.lg,
    width: 48,
    zIndex: 20,
  },
  exitIcon: { color: colors.brandPrimary, fontSize: 34, fontWeight: '700', lineHeight: 38 },
  foamBubble: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: '#8FD9E8',
    borderRadius: 999,
    borderWidth: 2,
    position: 'absolute',
    shadowColor: '#3FA9C4',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  foamLayer: {
    height: 92,
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    top: 0,
    width: 92,
  },
  instruction: { fontSize: 22, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
  mouthMap: {
    bottom: 16,
    height: 112,
    position: 'absolute',
    right: 8,
    width: 126,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(38,50,56,0.36)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 30,
  },
  progress: { color: colors.brandSecondary, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  pressed: { opacity: 0.7 },
  rewardChip: {
    backgroundColor: '#FFF0C9',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rewardRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  rewardValue: { color: colors.brandPrimary, fontWeight: '900' },
  resultCharacter: { height: 354, overflow: 'visible', zIndex: 1 },
  resultCurrentStage: { color: colors.brandPrimary, fontSize: 16, fontWeight: '900' },
  resultGrowth: { gap: spacing.sm, width: '84%' },
  resultNextStage: { color: colors.navy, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  resultStageInfo: { gap: 2 },
  resultXp: { color: colors.navy, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  resultXpFill: { backgroundColor: colors.brandAccent, borderRadius: radii.pill, height: '100%' },
  resultXpTrack: {
    backgroundColor: '#E9E2F7',
    borderRadius: radii.pill,
    height: 13,
    overflow: 'hidden',
  },
  remainingXp: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  growthMessage: {
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderRadius: radii.md,
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  growthMessageUnlocked: { color: colors.brandPrimary, fontWeight: '900' },
  regionTitle: { fontSize: 30, fontWeight: '900', lineHeight: 36 },
  segment: {
    backgroundColor: '#E4DED9',
    borderRadius: radii.pill,
    flex: 1,
    height: 10,
  },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentTrack: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  secondsLabel: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  sessionCard: {
    backgroundColor: colors.white,
    borderRadius: 32,
    gap: spacing.md,
    padding: spacing.md,
  },
  sessionContent: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 68,
  },
  sessionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  smileActiveLeftLower: { right: 8, top: 44 },
  smileActiveLeftUpper: { right: 8, top: 8 },
  smileActiveOverlay: {
    backgroundColor: 'rgba(129,80,230,0.28)',
    borderColor: '#9E6BFF',
    borderRadius: 12,
    borderWidth: 2,
    height: 48,
    position: 'absolute',
    shadowColor: '#7D4DE8',
    shadowOpacity: 0.85,
    shadowRadius: 7,
    width: 55,
  },
  smileActiveRightLower: { left: 8, top: 44 },
  smileActiveRightUpper: { left: 8, top: 8 },
  smileMap: { flex: 1, overflow: 'hidden' },
  smileMapImage: { height: '100%', width: '100%' },
  screen: { justifyContent: 'flex-start', padding: 0 },
  stageRug: {
    backgroundColor: '#ED91BB',
    borderRadius: radii.pill,
    bottom: 12,
    height: 24,
    position: 'absolute',
    width: 140,
  },
  streakResult: { color: colors.brandSecondary, fontWeight: '900', textAlign: 'center' },
  timerBadge: {
    alignItems: 'center',
    backgroundColor: colors.brandHighlight,
    borderRadius: radii.pill,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  timerText: { fontSize: 30, fontWeight: '900', lineHeight: 34 },
  totalRemaining: { fontSize: 15, lineHeight: 20, opacity: 0.68, textAlign: 'center' },
  toothbrush: { alignItems: 'center', flexDirection: 'row' },
  unlockResult: { color: colors.brandPrimary, fontWeight: '900', textAlign: 'center' },
  unlockCard: {
    backgroundColor: '#FFF0C9',
    borderColor: colors.brandHighlight,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.sm,
    padding: spacing.md,
  },
  rewardActions: { gap: spacing.sm },
  rewardItemName: {
    color: colors.textPrimary,
    fontFamily: typography.family.display,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
});
