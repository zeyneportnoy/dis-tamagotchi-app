import { Stack } from 'expo-router';

import { OnboardingDraftProvider } from '@/features/onboarding/OnboardingDraftContext';

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingDraftProvider>
  );
}
