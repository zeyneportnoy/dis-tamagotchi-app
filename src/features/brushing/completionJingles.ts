import type { AudioSource } from 'expo-audio';

export const completionJingles: readonly {
  id: string;
  path: string;
  source: AudioSource;
}[] = [
  {
    id: 'ta-da',
    path: 'assets/audio/success-ta-da.wav',
    source: require('../../../assets/audio/success-ta-da.wav'),
  },
  {
    id: 'rise-sparkle',
    path: 'assets/audio/success-rise-sparkle.wav',
    source: require('../../../assets/audio/success-rise-sparkle.wav'),
  },
  {
    id: 'ding-chime',
    path: 'assets/audio/success-ding-chime.wav',
    source: require('../../../assets/audio/success-ding-chime.wav'),
  },
  {
    id: 'arcade-level-up',
    path: 'assets/audio/success-arcade-level-up.wav',
    source: require('../../../assets/audio/success-arcade-level-up.wav'),
  },
  {
    id: 'marimba-pop',
    path: 'assets/audio/success-marimba-pop.wav',
    source: require('../../../assets/audio/success-marimba-pop.wav'),
  },
  {
    id: 'magic-sparkle',
    path: 'assets/audio/success-magic-sparkle.wav',
    source: require('../../../assets/audio/success-magic-sparkle.wav'),
  },
];

const recentJingleIndexes: number[] = [];

export function chooseCompletionJingleIndex(randomValue = Math.random()): number {
  const available = completionJingles
    .map((_, index) => index)
    .filter((index) => !recentJingleIndexes.includes(index));
  const pool = available.length > 0 ? available : completionJingles.map((_, index) => index);
  const poolIndex = Math.min(pool.length - 1, Math.floor(randomValue * pool.length));
  const selected = pool[poolIndex] ?? 0;
  recentJingleIndexes.push(selected);
  if (recentJingleIndexes.length > 2) recentJingleIndexes.shift();
  return selected;
}

export function resetCompletionJingleSelectionForTests(): void {
  recentJingleIndexes.splice(0, recentJingleIndexes.length);
}
