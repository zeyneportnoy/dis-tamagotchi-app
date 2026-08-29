import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BrushingPeriod, StoredAgeBand } from '@/domain/family';

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

export type CompletionRewardPresentation =
  | Readonly<{ kind: 'earned' }>
  | Readonly<{
      detailKey:
        | 'brushing.noReward.offSlotDetail'
        | 'brushing.noReward.nextEvening'
        | 'brushing.noReward.dayComplete';
      kind: 'notEarned';
      titleKey: 'brushing.noReward.offSlotTitle' | 'brushing.noReward.alreadyEarnedTitle';
    }>;

export function completionRewardPresentation(
  period: BrushingPeriod | null,
  xpGranted: number,
): CompletionRewardPresentation {
  if (xpGranted > 0) return { kind: 'earned' };
  if (period === null) {
    return {
      detailKey: 'brushing.noReward.offSlotDetail',
      kind: 'notEarned',
      titleKey: 'brushing.noReward.offSlotTitle',
    };
  }
  return {
    detailKey:
      period === 'morning' ? 'brushing.noReward.nextEvening' : 'brushing.noReward.dayComplete',
    kind: 'notEarned',
    titleKey: 'brushing.noReward.alreadyEarnedTitle',
  };
}

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
