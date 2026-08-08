import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
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

const regionKeys = ['upper', 'lower', 'outer', 'inner'] as const;

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
        <CharacterAvatar characterKey={profile.avatarId} />
        <Text style={styles.centerText} variant="title">
          {t('brushing.completeTitle')}
        </Text>
        <Text style={styles.centerText}>{t('brushing.completeBody')}</Text>
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
      <Text style={styles.eyebrow}>{t('brushing.title')}</Text>
      <Text style={styles.centerText} variant="title">
        {t(`brushing.regions.${region}`)}
      </Text>
      <Text style={styles.progress}>
        {t('brushing.progress', {
          current: snapshot.segmentIndex + 1,
          total: BRUSHING_SEGMENT_COUNT,
        })}
      </Text>
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
      <View style={styles.characterBubble}>
        <CharacterAvatar characterKey={profile.avatarId} size="small" />
      </View>
      <View
        accessible
        accessibilityLabel={t('brushing.totalRemaining', { seconds: snapshot.remainingSeconds })}
        style={styles.timer}
      >
        <Text style={styles.timerText}>
          {t('brushing.remaining', { seconds: snapshot.segmentRemainingSeconds })}
        </Text>
        <Text style={styles.totalRemaining}>
          {t('brushing.totalRemainingShort', { seconds: snapshot.remainingSeconds })}
        </Text>
      </View>
      <Text style={styles.instruction}>{t(`brushing.instructions.${region}`)}</Text>
      <Text style={styles.helper}>
        {t(profile.ageBand === '4_6' ? 'brushing.helperFourSix' : 'brushing.helperSevenEleven')}
      </Text>

      {exitConfirmation ? (
        <View accessibilityViewIsModal style={styles.dialog} testID="exit-confirmation">
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
      ) : paused ? (
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  controls: { gap: spacing.md },
  dialog: {
    backgroundColor: colors.white,
    borderColor: colors.brandSecondary,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.md,
    padding: spacing.lg,
  },
  characterBubble: {
    backgroundColor: '#F0EAFE',
    borderRadius: radii.pill,
    padding: spacing.sm,
  },
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
  helper: { textAlign: 'center' },
  instruction: { fontSize: 22, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
  progress: { color: colors.brandSecondary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  segment: {
    backgroundColor: '#E4DED9',
    borderRadius: radii.pill,
    flex: 1,
    height: 10,
  },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentTrack: { flexDirection: 'row', gap: spacing.sm, width: '82%' },
  screen: { alignItems: 'center', justifyContent: 'space-around' },
  timer: {
    alignItems: 'center',
    backgroundColor: colors.brandHighlight,
    borderColor: colors.white,
    borderWidth: 8,
    borderRadius: radii.pill,
    height: 180,
    justifyContent: 'center',
    width: 180,
  },
  timerText: { fontSize: 34, fontWeight: '800', lineHeight: 42 },
  totalRemaining: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
});
