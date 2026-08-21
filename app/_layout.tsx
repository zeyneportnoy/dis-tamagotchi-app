import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { ErrorState, LoadingState } from '@/design-system';
import { initializeDatabase } from '@/data/db';
import { AuthProvider } from '@/features/auth';
import { OnboardingDraftProvider } from '@/features/onboarding/OnboardingDraftContext';
import { configureNotificationPresentation } from '@/features/reminders/configureNotifications';
import '@/i18n';

void SplashScreen.preventAutoHideAsync();
configureNotificationPresentation();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2: require('../assets/fonts/Baloo2-Variable.ttf'),
    Manrope: require('../assets/fonts/Manrope-Variable.ttf'),
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void initializeDatabase()
      .then(() => setReady(true))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if ((ready && fontsLoaded) || failed || fontError) void SplashScreen.hideAsync();
  }, [failed, fontError, fontsLoaded, ready]);

  if (failed || fontError) return <ErrorState />;
  if (!ready || !fontsLoaded) return <LoadingState />;

  return (
    <AuthProvider>
      <OnboardingDraftProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OnboardingDraftProvider>
    </AuthProvider>
  );
}
