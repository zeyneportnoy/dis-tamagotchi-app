import { setAudioModeAsync } from 'expo-audio';

let audioModeReady: Promise<void> | undefined;

/**
 * Every Gökçe/Samet "Dinle" preview (onboarding's voice picker and Settings'
 * Sesli Rehber) must call this before playing. Without it, iOS uses its
 * default ambient audio session category, which the silent switch mutes —
 * `app/brushing.tsx`'s `activateBrushingAudioSession` already sets the same
 * `playsInSilentMode` flag for real brushing sessions, but only once a
 * brushing session has actually started; a preview tapped before that (the
 * common case for both screens) never benefited from it. This mirrors only
 * that one flag — not brushing's fuller `doNotMix`/recording configuration —
 * so a short preview never grabs exclusive audio focus from another app.
 *
 * The native audio session category is process-global and nothing in the
 * app ever reverts `playsInSilentMode` once set, so this only needs to run
 * once per app launch, memoized here regardless of which screen (or how
 * many times) triggers a preview.
 */
export function ensureVoicePreviewAudioMode(): Promise<void> {
  audioModeReady ??= setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  return audioModeReady;
}
