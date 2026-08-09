import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { ErrorState, LoadingState } from '@/design-system';
import { initializeDatabase } from '@/data/db';
import { AuthProvider } from '@/features/auth';
import '@/i18n';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void initializeDatabase()
      .then(() => setReady(true))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (ready || failed) void SplashScreen.hideAsync();
  }, [failed, ready]);

  if (failed) return <ErrorState />;
  if (!ready) return <LoadingState />;

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
