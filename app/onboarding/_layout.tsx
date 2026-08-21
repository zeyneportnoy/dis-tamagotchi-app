import { Stack } from 'expo-router';

import { BackButton } from '@/design-system';
import { sceneBackgroundForCharacter } from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';
export default function OnboardingLayout() {
  const draft = useOnboardingDraft();
  const backgroundColor = sceneBackgroundForCharacter(draft.avatarId ?? 'inci');
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor },
        headerLeft: () => <BackButton fallbackHref="/onboarding" />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor },
        headerTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
