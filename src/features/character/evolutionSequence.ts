import type { CharacterGrowthStage } from '@/domain/rewards';

export type EvolutionFrame = Readonly<{
  growthStage: CharacterGrowthStage;
  phase: 'resting' | 'crack-start' | 'cracking';
}>;

export function evolutionSequence(
  previousStage: CharacterGrowthStage,
  nextStage: CharacterGrowthStage,
): readonly EvolutionFrame[] {
  if (nextStage <= previousStage) return [{ growthStage: nextStage, phase: 'resting' }];
  if (previousStage === 0 && nextStage === 1) {
    return [
      { growthStage: 0, phase: 'resting' },
      { growthStage: 0, phase: 'crack-start' },
      { growthStage: 0, phase: 'cracking' },
      { growthStage: 1, phase: 'resting' },
    ];
  }
  return [
    { growthStage: previousStage, phase: 'resting' },
    { growthStage: nextStage, phase: 'resting' },
  ];
}
