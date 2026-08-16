import { starterAvatarKeys } from '@/domain/family';
import { characterMoodKeys } from '@/domain/character';

export const moodLabCharacters = starterAvatarKeys;
export const moodLabStages = [0, 1, 2, 3, 4] as const;
export const moodLabMoods = characterMoodKeys;

export type MoodLabMood = (typeof moodLabMoods)[number];

export const moodLabCombinationCount =
  moodLabCharacters.length * moodLabStages.length * moodLabMoods.length;
