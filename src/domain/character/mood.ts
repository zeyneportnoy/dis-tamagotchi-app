export const characterMoodKeys = [
  'neutral',
  'happy',
  'proud',
  'sleepy',
  'waiting',
  'sad',
  'crying',
] as const;

export type CharacterMood = (typeof characterMoodKeys)[number];

type CharacterMoodProgress = Readonly<{
  eveningCompleted: boolean;
  lastBrushingAt: string | null;
  morningCompleted: boolean;
}>;

const HOUR = 60 * 60 * 1000;

export function deriveHomeCharacterMood(
  progress: CharacterMoodProgress,
  now = new Date(),
): CharacterMood {
  const hour = now.getHours();

  if (progress.morningCompleted && progress.eveningCompleted) {
    return hour >= 22 || hour < 4 ? 'sleepy' : 'proud';
  }

  if (progress.morningCompleted || progress.eveningCompleted) {
    return progress.eveningCompleted && (hour >= 22 || hour < 4) ? 'sleepy' : 'happy';
  }

  const lastBrushingAt = progress.lastBrushingAt
    ? new Date(progress.lastBrushingAt).getTime()
    : Number.NaN;
  const hoursSinceLastBrushing = Number.isFinite(lastBrushingAt)
    ? (now.getTime() - lastBrushingAt) / HOUR
    : 0;

  // Crying is deliberately rare: it represents prolonged absence, never a same-day punishment.
  if (hoursSinceLastBrushing >= 48) return 'crying';
  if ((hour >= 11 && hour < 16) || hour >= 21) return 'sad';
  if ((hour >= 8 && hour < 11) || (hour >= 16 && hour < 21)) return 'waiting';
  return 'neutral';
}
