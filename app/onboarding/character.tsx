import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getFamilyUseCases } from '@/application/family';

import {
  Button,
  Screen,
  Text,
  colors,
  minimumTouchTarget,
  radii,
  spacing,
  typography,
} from '@/design-system';
import { starterAvatarKeys, type StarterAvatarKey } from '@/domain/family';
import type { CharacterGrowthStage } from '@/domain/rewards';
import {
  CharacterAvatar,
  CharacterSceneDecor,
  CharacterScreenBackdrop,
  sceneBackgroundForCharacter,
  sceneToneForCharacter,
} from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';
import {
  carouselIndexFromOffset,
  carouselIndexFromWheel,
} from '@/features/onboarding/characterCarousel';

const avatarAt = (index: number): StarterAvatarKey =>
  starterAvatarKeys[index] ?? starterAvatarKeys[0];
const previewStages: readonly {
  growthStage: CharacterGrowthStage;
  phase: 'resting' | 'cracking';
}[] = [
  { growthStage: 0, phase: 'resting' },
  { growthStage: 0, phase: 'cracking' },
  { growthStage: 2, phase: 'resting' },
  { growthStage: 3, phase: 'resting' },
  { growthStage: 4, phase: 'resting' },
];
export default function CharacterScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const carousel = useRef<ScrollView>(null);
  const programmaticTargetIndex = useRef<number | null>(null);
  const selectedIndexRef = useRef(0);
  const scrollSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelCooldown = useRef(false);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const selectedIndex = Math.max(
    0,
    starterAvatarKeys.indexOf(draft.avatarId ?? starterAvatarKeys[0]),
  );
  const selected = avatarAt(selectedIndex);
  const slideWidth = carouselWidth > 0 ? Math.round(carouselWidth * 0.82) : 320;
  const preview = previewStages[previewIndex] ?? {
    growthStage: 0,
    phase: 'resting' as const,
  };

  useEffect(() => {
    if (!draft.avatarId) draft.setAvatarId(starterAvatarKeys[0]);

    const interval = setInterval(
      () => setPreviewIndex((current) => (current + 1) % previewStages.length),
      1050,
    );
    return () => clearInterval(interval);
  }, [draft]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      carousel.current?.scrollTo({
        animated: false,
        x: selectedIndexRef.current * slideWidth,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [slideWidth]);

  useEffect(
    () => () => {
      if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
    },
    [],
  );

  const choose = (avatar: StarterAvatarKey): void => {
    const index = starterAvatarKeys.indexOf(avatar);
    if (index < 0) return;
    if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);

    selectedIndexRef.current = index;
    programmaticTargetIndex.current = index;
    setPreviewIndex(0);
    draft.setAvatarId(avatar);
    carousel.current?.scrollTo({ animated: true, x: index * slideWidth });
  };

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const programmaticIndex = programmaticTargetIndex.current;
    if (programmaticIndex !== null) {
      programmaticTargetIndex.current = null;
      const targetOffset = programmaticIndex * slideWidth;
      if (Math.abs(event.nativeEvent.contentOffset.x - targetOffset) > 1) {
        carousel.current?.scrollTo({ animated: false, x: targetOffset });
      }
      return;
    }

    const measuredIndex = carouselIndexFromOffset(
      event.nativeEvent.contentOffset.x,
      slideWidth,
      starterAvatarKeys.length,
    );
    const currentIndex = selectedIndexRef.current;
    const index = Math.max(currentIndex - 1, Math.min(currentIndex + 1, measuredIndex));
    choose(avatarAt(index));
  };

  const settleAfterScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
    const offset = event.nativeEvent.contentOffset.x;
    scrollSettleTimer.current = setTimeout(() => {
      const programmaticIndex = programmaticTargetIndex.current;
      if (programmaticIndex !== null) {
        programmaticTargetIndex.current = null;
        const targetOffset = programmaticIndex * slideWidth;
        if (Math.abs(offset - targetOffset) > 1) {
          carousel.current?.scrollTo({ animated: false, x: targetOffset });
        }
        return;
      }

      const index = carouselIndexFromOffset(offset, slideWidth, starterAvatarKeys.length);
      if (index === selectedIndexRef.current) {
        carousel.current?.scrollTo({ animated: true, x: index * slideWidth });
      } else {
        choose(avatarAt(index));
      }
    }, 120);
  };

  const wheelProps =
    Platform.OS === 'web'
      ? {
          onWheel: (event: {
            preventDefault?: () => void;
            nativeEvent?: { deltaX?: number; deltaY?: number };
          }) => {
            const deltaX = event.nativeEvent?.deltaX ?? 0;
            const deltaY = event.nativeEvent?.deltaY ?? 0;
            const nextIndex = carouselIndexFromWheel(
              selectedIndexRef.current,
              deltaX,
              deltaY,
              starterAvatarKeys.length,
            );
            if (nextIndex === selectedIndexRef.current || wheelCooldown.current) return;
            event.preventDefault?.();
            choose(avatarAt(nextIndex));
            wheelCooldown.current = true;
            setTimeout(() => {
              wheelCooldown.current = false;
            }, 280);
          },
        }
      : {};

  return (
    <Screen
      style={[styles.screen, { backgroundColor: sceneBackgroundForCharacter(selected) }]}
      testID="character-selection-screen"
    >
      <CharacterScreenBackdrop characterKey={selected} />
      <View style={styles.copy}>
        <Text style={styles.center} variant="title">
          {t('onboarding.character.title')}
        </Text>
        <Text style={styles.center}>{t('onboarding.character.body')}</Text>
      </View>

      <View
        {...wheelProps}
        onLayout={(event: LayoutChangeEvent) => setCarouselWidth(event.nativeEvent.layout.width)}
        style={styles.world}
        testID="character-carousel-region"
      >
        <CharacterSceneDecor tone={sceneToneForCharacter(selected)} />
        <Text style={styles.sparkleLeft}>✦</Text>
        <Text style={styles.sparkleRight}>★</Text>
        <Pressable
          accessibilityLabel={t('onboarding.character.previous')}
          accessibilityRole="button"
          disabled={selectedIndex === 0}
          onPress={() => choose(avatarAt(selectedIndexRef.current - 1))}
          style={[styles.arrow, styles.arrowLeft, selectedIndex === 0 && styles.disabled]}
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <ScrollView
          contentContainerStyle={[
            styles.carouselContent,
            { paddingHorizontal: Math.max(0, (carouselWidth - slideWidth) / 2) },
          ]}
          decelerationRate="fast"
          directionalLockEnabled={false}
          horizontal
          onScrollBeginDrag={() => {
            programmaticTargetIndex.current = null;
          }}
          onScroll={Platform.OS === 'web' ? settleAfterScroll : undefined}
          onScrollEndDrag={settle}
          onMomentumScrollEnd={settle}
          ref={carousel}
          scrollEventThrottle={16}
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={slideWidth}
          style={styles.carousel}
          testID="character-carousel"
        >
          {starterAvatarKeys.map((avatar) => (
            <View key={avatar} style={[styles.slide, { width: slideWidth }]}>
              <CharacterAvatar
                characterKey={avatar}
                growthStage={preview.growthStage}
                phase={preview.phase}
                size="large"
                surface="plain"
              />
              <View style={styles.pedestal} />
            </View>
          ))}
        </ScrollView>
        <Pressable
          accessibilityLabel={t('onboarding.character.next')}
          accessibilityRole="button"
          disabled={selectedIndex === starterAvatarKeys.length - 1}
          onPress={() => choose(avatarAt(selectedIndexRef.current + 1))}
          style={[
            styles.arrow,
            styles.arrowRight,
            selectedIndex === starterAvatarKeys.length - 1 && styles.disabled,
          ]}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.characterCode}>
          {t(`onboarding.character.options.${selected}`)}
        </Text>
        <View style={styles.previewRow}>
          {starterAvatarKeys.map((avatar) => (
            <Pressable
              accessibilityLabel={t(`onboarding.character.options.${avatar}`)}
              accessibilityRole="radio"
              accessibilityState={{ selected: avatar === selected }}
              key={avatar}
              onPress={() => choose(avatar)}
              style={[styles.preview, avatar === selected && styles.previewSelected]}
            >
              <CharacterAvatar characterKey={avatar} growthStage={4} size="tiny" surface="plain" />
            </Pressable>
          ))}
        </View>
      </View>

      <Button
        disabled={saving}
        label={t('common.continue')}
        onPress={() => {
          if (draft.profileId) {
            setSaving(true);
            void getFamilyUseCases()
              .then((family) => family.updateProfile(draft.profileId!, { avatarId: selected }))
              .then(() => {
                draft.reset();
                router.replace('/(child)');
              })
              .catch(() => setSaving(false));
            return;
          }
          router.push('/onboarding/summary');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  arrow: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: minimumTouchTarget,
    justifyContent: 'center',
    position: 'absolute',
    top: '44%',
    width: minimumTouchTarget,
    zIndex: 4,
  },
  arrowLeft: { left: spacing.md },
  arrowRight: { right: spacing.md },
  arrowText: {
    color: colors.brandPrimary,
    fontFamily: typography.family.display,
    fontSize: 38,
    lineHeight: 42,
  },
  center: { textAlign: 'center' },
  carousel: { flex: 1 },
  carouselContent: { alignItems: 'stretch' },
  characterCode: {
    alignSelf: 'stretch',
    color: colors.brandPrimary,
    fontFamily: typography.family.display,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 34,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  copy: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: radii.lg,
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
  },
  disabled: { opacity: 0.3 },
  identity: { alignItems: 'center', gap: spacing.sm },
  pedestal: {
    backgroundColor: '#B27DE2',
    borderRadius: radii.pill,
    height: 28,
    marginTop: -31,
    width: 186,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'transparent',
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 52,
    justifyContent: 'center',
    width: 42,
  },
  previewRow: { flexDirection: 'row', gap: 3, justifyContent: 'center', width: '100%' },
  previewSelected: {
    backgroundColor: '#FFF0C9',
    borderColor: colors.brandPrimary,
    transform: [{ scale: 1.12 }],
  },
  screen: { justifyContent: 'space-between', paddingHorizontal: 0 },
  slide: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  sparkleLeft: {
    color: colors.brandHighlight,
    fontSize: 30,
    left: 34,
    position: 'absolute',
    top: 38,
  },
  sparkleRight: {
    color: colors.brandSecondary,
    fontSize: 25,
    position: 'absolute',
    right: 38,
    top: 76,
  },
  world: {
    backgroundColor: '#E6D9FF',
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
    borderTopLeftRadius: 44,
    borderTopRightRadius: 44,
    height: 348,
    overflow: 'hidden',
    position: 'relative',
  },
});
