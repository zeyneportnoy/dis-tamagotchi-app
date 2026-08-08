import { Stack } from 'expo-router';

import { BackButton, colors } from '@/design-system';
import { OnboardingDraftProvider } from '@/features/onboarding/OnboardingDraftContext';

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.backgroundBase },
          headerLeft: () => <BackButton fallbackHref="/onboarding" />,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.backgroundBase },
          headerTitle: '',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </OnboardingDraftProvider>
  );
}
