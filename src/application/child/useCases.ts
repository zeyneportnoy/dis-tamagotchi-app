import type { BrushingPeriod, ProfileProgress, ProfileProgressRepository } from '@/domain/family';

export class ChildExperienceUseCases {
  constructor(private readonly progress: ProfileProgressRepository) {}

  getProgress(profileId: string): Promise<ProfileProgress> {
    return this.progress.get(profileId);
  }

  setBrushingCompleted(
    profileId: string,
    period: BrushingPeriod,
    completed: boolean,
  ): Promise<ProfileProgress> {
    return this.progress.setBrushingCompleted(profileId, period, completed);
  }
}
