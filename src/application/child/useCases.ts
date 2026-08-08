import type {
  BrushingPeriod,
  BrushingSession,
  BrushingSessionRepository,
  ProfileProgress,
  ProfileProgressRepository,
} from '@/domain/family';
import { BRUSHING_TOTAL_SECONDS } from '@/domain/brushing';

export class ChildExperienceUseCases {
  constructor(
    private readonly progress: ProfileProgressRepository,
    private readonly sessions: BrushingSessionRepository,
  ) {}

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

  completeBrushingSession(profileId: string, startedAt: string): Promise<BrushingSession> {
    return this.sessions.complete({
      profileId,
      startedAt,
      durationSeconds: BRUSHING_TOTAL_SECONDS,
    });
  }

  listCompletedSessions(profileId: string): Promise<readonly BrushingSession[]> {
    return this.sessions.listCompleted(profileId);
  }
}
