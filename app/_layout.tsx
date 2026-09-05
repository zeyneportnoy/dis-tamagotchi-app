import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getChildExperienceUseCases } from '@/application/child';
import { getFamilyUseCases } from '@/application/family';
import { ensureChildDataRecovered } from '@/application/sync';
import { perfMark, perfStep } from '@/config/perf';
import { ErrorState } from '@/design-system';
import { initializeDatabase } from '@/data/db';
import { nextBrushingSlotCloseAfter } from '@/domain/brushing';
import { AuthProvider, useAuth } from '@/features/auth';
import { OnboardingDraftProvider } from '@/features/onboarding/OnboardingDraftContext';
import { configureNotificationPresentation } from '@/features/reminders/configureNotifications';
import { BrandedSplash } from '@/features/splash';
import '@/i18n';

perfMark('js:root-module-eval');
void SplashScreen.preventAutoHideAsync();
configureNotificationPresentation();

const SPLASH_MINIMUM_VISIBLE_MS = 2_000;
const splashShownAt = Date.now();

function MissedSlotReconciler() {
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading || !session?.emailVerified) return;
    let disposed = false;
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined;
    let reconciliation: Promise<void> | null = null;

    const reconcileAllChildren = (): Promise<void> => {
      reconciliation ??= (async () => {
        // Missed-slot reconciliation must never run ahead of cloud history
        // hydration: an unhydrated local device looks exactly like a wall of
        // missed slots and would apply real -10 penalties for brushing that
        // already happened. This resolves instantly once recovery has already
        // run this session.
        await ensureChildDataRecovered();
        const family = await getFamilyUseCases();
        const child = await getChildExperienceUseCases();
        for (const profile of await family.listProfiles()) {
          await child.getProgress(profile.id);
        }
      })()
        .catch((error) => {
          console.error('[MissedSlotReconciler] reconcileAllChildren failed', error);
        })
        .finally(() => {
          reconciliation = null;
        });
      return reconciliation;
    };

    const scheduleNextBoundary = (): void => {
      if (disposed || AppState.currentState !== 'active') return;
      if (boundaryTimer) clearTimeout(boundaryTimer);
      const now = new Date();
      const delay = Math.max(0, nextBrushingSlotCloseAfter(now).getTime() - now.getTime() + 50);
      boundaryTimer = setTimeout(() => {
        void reconcileAllChildren().finally(scheduleNextBoundary);
      }, delay);
    };

    void reconcileAllChildren().finally(scheduleNextBoundary);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (boundaryTimer) {
        clearTimeout(boundaryTimer);
        boundaryTimer = undefined;
      }
      if (state === 'active') void reconcileAllChildren().finally(scheduleNextBoundary);
    });

    return () => {
      disposed = true;
      if (boundaryTimer) clearTimeout(boundaryTimer);
      appStateSubscription.remove();
    };
  }, [loading, session?.emailVerified, session?.userId]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2: require('../assets/fonts/Baloo2-Variable.ttf'),
    Manrope: require('../assets/fonts/Manrope-Variable.ttf'),
  });
  const [ready, setReady] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(
    Date.now() - splashShownAt >= SPLASH_MINIMUM_VISIBLE_MS,
  );
  const [failed, setFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string | undefined>(undefined);

  perfMark('layout:render');

  useEffect(() => {
    perfMark('layout:mount');
    void perfStep('layout:initializeDatabase', () => initializeDatabase())
      .then(() => setReady(true))
      .catch((error: unknown) => {
        console.error('initializeDatabase failed', error);
        setFailureReason(error instanceof Error ? error.message : String(error));
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    const remaining = SPLASH_MINIMUM_VISIBLE_MS - (Date.now() - splashShownAt);
    if (remaining <= 0) {
      setMinimumSplashElapsed(true);
      return;
    }
    const timer = setTimeout(() => setMinimumSplashElapsed(true), remaining);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (minimumSplashElapsed && ((ready && fontsLoaded) || failed || fontError)) {
      perfMark('layout:splash-hide');
      void SplashScreen.hideAsync();
    }
  }, [failed, fontError, fontsLoaded, minimumSplashElapsed, ready]);

  if (failed || fontError) {
    const dbReason = failureReason;
    const fontReason = fontError
      ? ((fontError as { message?: string }).message ?? String(fontError))
      : undefined;
    const reason = `[TEŞHİS v2] db=${dbReason ?? 'yok'} | font=${fontReason ?? 'yok'}`;
    return <ErrorState body={reason} />;
  }
  if (!ready || !fontsLoaded) return <BrandedSplash />;

  return (
    <AuthProvider>
      <MissedSlotReconciler />
      <OnboardingDraftProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OnboardingDraftProvider>
    </AuthProvider>
  );
}
