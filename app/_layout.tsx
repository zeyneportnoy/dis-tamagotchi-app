import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { perfMark, perfStep } from '@/config/perf';
import { ErrorState } from '@/design-system';
import { initializeDatabase } from '@/data/db';
import { AuthProvider } from '@/features/auth';
import { OnboardingDraftProvider } from '@/features/onboarding/OnboardingDraftContext';
import { configureNotificationPresentation } from '@/features/reminders/configureNotifications';
import { BrandedSplash } from '@/features/splash';
import '@/i18n';

perfMark('js:root-module-eval');
void SplashScreen.preventAutoHideAsync();
configureNotificationPresentation();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2: require('../assets/fonts/Baloo2-Variable.ttf'),
    Manrope: require('../assets/fonts/Manrope-Variable.ttf'),
  });
  const [ready, setReady] = useState(false);
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
    if ((ready && fontsLoaded) || failed || fontError) {
      perfMark('layout:splash-hide');
      void SplashScreen.hideAsync();
    }
  }, [failed, fontError, fontsLoaded, ready]);

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
      <OnboardingDraftProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OnboardingDraftProvider>
    </AuthProvider>
  );
}
