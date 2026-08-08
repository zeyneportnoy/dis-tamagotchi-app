import type { SQLiteDatabase } from 'expo-sqlite';

import type { BrushingPeriod, ProfileProgress, ProfileProgressRepository } from '@/domain/family';

type ProgressRow = {
  child_profile_id: string;
  status_date: string;
  morning_completed: number;
  evening_completed: number;
  current_streak: number;
  last_interaction_at: string | null;
  last_brushing_at: string | null;
};

const mapProgress = (row: ProgressRow): ProfileProgress => ({
  childProfileId: row.child_profile_id,
  statusDate: row.status_date,
  morningCompleted: row.morning_completed === 1,
  eveningCompleted: row.evening_completed === 1,
  currentStreak: row.current_streak,
  lastInteractionAt: row.last_interaction_at,
  lastBrushingAt: row.last_brushing_at,
});

export class SQLiteProfileProgressRepository implements ProfileProgressRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private today(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private async ensure(profileId: string): Promise<void> {
    const today = this.today();
    await this.database.runAsync(
      `INSERT OR IGNORE INTO profile_progress (child_profile_id, status_date) VALUES (?, ?)`,
      profileId,
      today,
    );
    await this.database.runAsync(
      `UPDATE profile_progress
       SET status_date = ?, morning_completed = 0, evening_completed = 0
       WHERE child_profile_id = ? AND status_date <> ?`,
      today,
      profileId,
      today,
    );
  }

  async get(profileId: string): Promise<ProfileProgress> {
    await this.ensure(profileId);
    const row = await this.database.getFirstAsync<ProgressRow>(
      'SELECT * FROM profile_progress WHERE child_profile_id = ?',
      profileId,
    );
    if (!row) throw new Error('PROFILE_PROGRESS_NOT_FOUND');
    return mapProgress(row);
  }

  async setBrushingCompleted(
    profileId: string,
    period: BrushingPeriod,
    completed: boolean,
  ): Promise<ProfileProgress> {
    await this.ensure(profileId);
    const timestamp = this.now().toISOString();
    const column = period === 'morning' ? 'morning_completed' : 'evening_completed';
    await this.database.runAsync(
      `UPDATE profile_progress
       SET ${column} = ?, status_date = ?, last_interaction_at = ?,
           last_brushing_at = CASE WHEN ? = 1 THEN ? ELSE last_brushing_at END
       WHERE child_profile_id = ?`,
      completed ? 1 : 0,
      this.today(),
      timestamp,
      completed ? 1 : 0,
      timestamp,
      profileId,
    );
    return this.get(profileId);
  }
}
