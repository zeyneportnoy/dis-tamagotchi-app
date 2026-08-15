import { growthStageForXp } from '@/domain/rewards';

export function growthCompletionMessageKey(
  previousXp: number,
  currentXp: number,
): 'brushing.growthUnlocked' | 'brushing.growthSteady' {
  return growthStageForXp(currentXp) > growthStageForXp(previousXp)
    ? 'brushing.growthUnlocked'
    : 'brushing.growthSteady';
}
