import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
} from '@/design-system';
import {
  BRUSHING_SEGMENT_COUNT,
  getBrushingTimerSnapshot,
  pauseBrushingTimer,
  resumeBrushingTimer,
  startBrushingTimer,
  type BrushingTimerState,
} from '@/domain/brushing';
import { CharacterAvatar } from '@/features/character';

const regionKeys = ['rightUpper', 'leftUpper', 'rightLower', 'leftLower'] as const;

export default function BrushingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const startedAt = useRef<string | null>(null);
  const completionStarted = useRef(false);
  const allowExit = useRef(false);
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [timer, setTimer] = useState<BrushingTimerState | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [exitConfirmation, setExitConfirmation] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const snapshot = timer ? getBrushingTimerSnapshot(timer, nowMs) : null;
  const region = regionKeys[snapshot?.segmentIndex ?? 0] ?? regionKeys[0];

  useEffect(() => {
    void Promise.resolve().then(() => {
      const initialNow = Date.now();
      startedAt.current = new Date(initialNow).toISOString();
      setTimer(startBrushingTimer(initialNow));
      setNowMs(initialNow);
    });
  }, []);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (completed || allowExit.current) return;
        event.preventDefault();
        const current = Date.now();
        setTimer((state) => (state ? pauseBrushingTimer(state, current) : state));
        setNowMs(current);
        setExitConfirmation(true);
      }),
    [completed, navigation],
  );

  useEffect(() => {
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then((activeProfile) => {
        if (!activeProfile) return router.replace('/onboarding');
        setProfile(activeProfile);
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
      .then((useCases) => useCases.completeBrushingSession(profile.id, sessionStartedAt))
      .then(() => setCompleted(true))
      .catch(() => setFailed(true));
  }, [profile, snapshot?.completed]);

  if (failed) return <ErrorState body={t('brushing.saveError')} />;
  if (!profile || !timer || !snapshot) return <LoadingState label={t('brushing.loading')} />;

  if (completed) {
    return (
      <Screen style={styles.centered} testID="brushing-complete-screen">
        <View style={styles.celebrationStage}>
          <Text style={styles.confettiLeft}>✦</Text>
          <Text style={styles.confettiRight}>★</Text>
          <CharacterAvatar characterKey={profile.avatarId} size="hero" surface="plain" />
          <View style={styles.celebrationRug} />
        </View>
        <View style={styles.completionCopy}>
          <Text style={styles.centerText} variant="title">
            {t('brushing.completeTitle')}
          </Text>
          <Text style={styles.centerText}>{t('brushing.completeBody')}</Text>
        </View>
        <Button
          label={t('brushing.home')}
          onPress={() => {
            allowExit.current = true;
            router.replace('/(child)');
          }}
        />
      </Screen>
    );
  }

  const paused = timer.status === 'paused';
  const requestExit = (): void => {
    const current = Date.now();
    setTimer((state) => (state ? pauseBrushingTimer(state, current) : state));
    setNowMs(current);
    setExitConfirmation(true);
  };
  return (
    <Screen style={styles.screen} testID="brushing-session-screen">
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
            <CharacterAvatar characterKey={profile.avatarId} size="large" surface="plain" />
            <View accessibilityLabel={t(`brushing.regions.${region}`)} style={styles.mouthMap}>
              {regionKeys.map((key, index) => (
                <View
                  key={key}
                  style={[
                    styles.mouthQuadrant,
                    index === 0 && styles.mouthRightUpper,
                    index === 1 && styles.mouthLeftUpper,
                    index === 2 && styles.mouthRightLower,
                    index === 3 && styles.mouthLeftLower,
                    index === snapshot.segmentIndex && styles.mouthQuadrantActive,
                  ]}
                />
              ))}
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
            <View style={styles.dialogIcon}>
              <Text style={styles.dialogIconText}>?</Text>
            </View>
            <Text style={styles.centerText} variant="title">
              {t('brushing.exitQuestion')}
            </Text>
            <Button label={t('brushing.stay')} onPress={() => setExitConfirmation(false)} />
            <Button
              label={t('brushing.exit')}
              onPress={() => {
                allowExit.current = true;
                router.back();
              }}
              variant="secondary"
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center',
    backgroundColor: '#F9D7E5',
    borderRadius: 28,
    height: 190,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  celebrationRug: {
    backgroundColor: '#D783C1',
    borderRadius: radii.pill,
    bottom: 24,
    height: 28,
    position: 'absolute',
    width: 180,
  },
  celebrationStage: {
    alignItems: 'center',
    backgroundColor: '#D9C7FF',
    borderRadius: 34,
    height: 330,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  centered: { alignItems: 'center', justifyContent: 'space-between' },
  centerText: { textAlign: 'center' },
  completionCopy: { gap: spacing.sm },
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
  controls: { gap: spacing.md },
  dialog: {
    backgroundColor: colors.white,
    borderRadius: 32,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  dialogIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFF0C9',
    borderRadius: radii.pill,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  dialogIconText: { color: colors.brandSecondary, fontSize: 34, fontWeight: '900', lineHeight: 40 },
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
  },
  exitIcon: { color: colors.brandPrimary, fontSize: 34, fontWeight: '700', lineHeight: 38 },
  instruction: { fontSize: 22, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
  mouthLeftLower: { borderBottomLeftRadius: 18, bottom: 7, left: 7 },
  mouthLeftUpper: { borderTopLeftRadius: 18, left: 7, top: 7 },
  mouthMap: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    bottom: spacing.sm,
    height: 62,
    position: 'absolute',
    right: spacing.sm,
    width: 86,
  },
  mouthQuadrant: {
    backgroundColor: '#F8DCE6',
    borderColor: colors.white,
    borderWidth: 2,
    height: 24,
    position: 'absolute',
    width: 34,
  },
  mouthQuadrantActive: {
    backgroundColor: colors.brandHighlight,
    borderColor: colors.brandSecondary,
    borderWidth: 3,
  },
  mouthRightLower: { borderBottomRightRadius: 18, bottom: 7, right: 7 },
  mouthRightUpper: { borderTopRightRadius: 18, right: 7, top: 7 },
  modalBackdrop: {
    backgroundColor: 'rgba(38,50,56,0.36)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  progress: { color: colors.brandSecondary, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  pressed: { opacity: 0.7 },
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
  screen: { justifyContent: 'flex-start', padding: 0 },
  stageRug: {
    backgroundColor: '#ED91BB',
    borderRadius: radii.pill,
    bottom: 12,
    height: 24,
    position: 'absolute',
    width: 140,
  },
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
});
