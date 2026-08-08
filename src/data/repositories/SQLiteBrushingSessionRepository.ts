import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { determineBrushingPeriod, toLocalDateKey } from '@/domain/brushing';
import type {
  BrushingPeriod,
  BrushingSession,
  BrushingSessionRepository,
  CompleteBrushingSessionInput,
} from '@/domain/family';

type SessionRow = {
  id: string;
  profile_id: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  completed: number;
  period: BrushingPeriod;
  created_at: string;
};

const mapSession = (row: SessionRow): BrushingSession => ({
  id: row.id,
  profileId: row.profile_id,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  durationSeconds: row.duration_seconds,
  completed: row.completed === 1,
  period: row.period,
  createdAt: row.created_at,
});

export class SQLiteBrushingSessionRepository implements BrushingSessionRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async complete(input: CompleteBrushingSessionInput): Promise<BrushingSession> {
    const completedAt = this.now();
    const completedAtIso = completedAt.toISOString();
    const period = determineBrushingPeriod(completedAt);
    const session: BrushingSession = {
      id: this.createId(),
      profileId: input.profileId,
      startedAt: input.startedAt,
      completedAt: completedAtIso,
      durationSeconds: input.durationSeconds,
      completed: true,
      period,
      createdAt: completedAtIso,
    };
    const progressColumn = period === 'morning' ? 'morning_completed' : 'evening_completed';
    const statusDate = toLocalDateKey(completedAt);

    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `INSERT INTO brushing_sessions
          (id, profile_id, started_at, completed_at, duration_seconds, completed, period, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        session.id,
        session.profileId,
        session.startedAt,
        session.completedAt,
        session.durationSeconds,
        session.period,
        session.createdAt,
      );
      await this.database.runAsync(
        `INSERT OR IGNORE INTO profile_progress (child_profile_id, status_date) VALUES (?, ?)`,
        session.profileId,
        statusDate,
      );
      await this.database.runAsync(
        `UPDATE profile_progress
         SET status_date = ?, morning_completed = 0, evening_completed = 0
         WHERE child_profile_id = ? AND status_date <> ?`,
        statusDate,
        session.profileId,
        statusDate,
      );
      await this.database.runAsync(
        `UPDATE profile_progress
         SET ${progressColumn} = 1, last_interaction_at = ?, last_brushing_at = ?
         WHERE child_profile_id = ?`,
        completedAtIso,
        completedAtIso,
        session.profileId,
      );
    });
    return session;
  }

  async listCompleted(profileId: string): Promise<readonly BrushingSession[]> {
    const rows = await this.database.getAllAsync<SessionRow>(
      `SELECT * FROM brushing_sessions
       WHERE profile_id = ? AND completed = 1 ORDER BY completed_at`,
      profileId,
    );
    return rows.map(mapSession);
  }
}
