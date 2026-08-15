import { starterAvatarKeys } from '@/domain/family';

export const moodLabCharacters = starterAvatarKeys;
export const moodLabStages = [0, 1, 2, 3, 4] as const;
export const moodLabMoods = [
  'neutral',
  'happy',
  'proud',
  'sleepy',
  'dirty',
  'sad',
  'crying',
] as const;

export type MoodLabMood = (typeof moodLabMoods)[number];

export const moodLabCombinationCount =
  moodLabCharacters.length * moodLabStages.length * moodLabMoods.length;
