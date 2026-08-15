import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StoredAgeBand } from '@/domain/family';

const lastCompletionMessageKey = 'brushing.completion.last-message-index';

export const completionMessageKeysFourSix = [
  'brushing.celebrations.fourSix.sparkling',
  'brushing.celebrations.fourSix.friendHappy',
  'brushing.celebrations.fourSix.greatBrushing',
  'brushing.celebrations.fourSix.success',
] as const;

export const completionMessageKeysSevenEleven = [
  'brushing.celebrations.sevenEleven.greatJob',
  'brushing.celebrations.sevenEleven.missionComplete',
  'brushing.celebrations.sevenEleven.keepGoing',
  'brushing.celebrations.sevenEleven.sparkling',
] as const;

export async function nextCompletionMessageKey(ageBand: StoredAgeBand): Promise<string> {
  const keys = ageBand === '4_6' ? completionMessageKeysFourSix : completionMessageKeysSevenEleven;
  const previous = Number(await AsyncStorage.getItem(lastCompletionMessageKey));
  const randomIndex = Math.floor(Math.random() * keys.length);
  const nextIndex =
    Number.isInteger(previous) && randomIndex === previous
      ? (randomIndex + 1) % keys.length
      : randomIndex;
  await AsyncStorage.setItem(lastCompletionMessageKey, String(nextIndex));
  return keys[nextIndex] ?? keys[0];
}
