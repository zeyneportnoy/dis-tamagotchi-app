import type { SQLiteDatabase } from 'expo-sqlite';

import { toLocalDateKey } from '@/domain/brushing';
import type { BrushingPeriod, ProfileProgress, ProfileProgressRepository } from '@/domain/family';
import { deriveStreak } from '@/domain/rewards';

type ProgressRow = {
  child_profile_id: string;
  status_date: string;
  morning_completed: number;
  evening_completed: number;
  current_streak: number;
  total_xp: number;
  level: number;
  mood: number;
  last_interaction_at: string | null;
  last_brushing_at: string | null;
};

const mapProgress = (row: ProgressRow): ProfileProgress => ({
  childProfileId: row.child_profile_id,
  statusDate: row.status_date,
  morningCompleted: row.morning_completed === 1,
  eveningCompleted: row.evening_completed === 1,
  currentStreak: row.current_streak,
  totalXp: row.total_xp,
  level: row.level,
  mood: row.mood,
  lastInteractionAt: row.last_interaction_at,
  lastBrushingAt: row.last_brushing_at,
});

export class SQLiteProfileProgressRepository implements ProfileProgressRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private today(): string {
    return toLocalDateKey(this.now());
  }

  private async ensure(profileId: string): Promise<void> {
    const today = this.today();
    await this.database.runAsync(
      `INSERT OR IGNORE INTO profile_progress (child_profile_id, status_date) VALUES (?, ?)`,
      profileId,
      today,
    );
    await this.database.runAsync(
      `INSERT OR IGNORE INTO daily_progress(child_profile_id, local_day_key) VALUES (?, ?)`,
      profileId,
      today,
    );
    await this.database.runAsync(
      `UPDATE profile_progress SET status_date = ?,
        morning_completed = (SELECT morning_completed FROM daily_progress
          WHERE child_profile_id = ? AND local_day_key = ?),
        evening_completed = (SELECT evening_completed FROM daily_progress
          WHERE child_profile_id = ? AND local_day_key = ?)
       WHERE child_profile_id = ?`,
      today,
      profileId,
      today,
      profileId,
      today,
      profileId,
    );
    // Streak is a pure derivation of the full-day history this device holds:
    // the count of consecutive local calendar days (ending today or yesterday)
    // with both slots completed. Recomputed here from the row SET — never a
    // running counter, never a session count — so it is identical on every
    // device once brushing history has hydrated, and it both drops a stale
    // streak to 0 and repairs one left wrongly low by out-of-order hydration.
    // Skipped entirely while this child still has NO local full-day rows, so a
    // freshly cloud-recovered streak whose history has not been hydrated yet
    // this session is left intact.
    const fullDays = await this.database.getAllAsync<{ local_day_key: string }>(
      `SELECT local_day_key FROM daily_progress
       WHERE child_profile_id = ? AND full_day_completed = 1`,
      profileId,
    );
    if (fullDays.length > 0) {
      const keys = fullDays.map((row) => row.local_day_key);
      await this.database.runAsync(
        `UPDATE profile_progress SET current_streak = ? WHERE child_profile_id = ?`,
        deriveStreak(keys, today),
        profileId,
      );
    }
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
      `UPDATE daily_progress SET ${column} = ?,
        full_day_completed = CASE
          WHEN (CASE WHEN ? = 'morning_completed' THEN ? ELSE morning_completed END) = 1
           AND (CASE WHEN ? = 'evening_completed' THEN ? ELSE evening_completed END) = 1
          THEN 1 ELSE 0 END
       WHERE child_profile_id = ? AND local_day_key = ?`,
      completed ? 1 : 0,
      column,
      completed ? 1 : 0,
      column,
      completed ? 1 : 0,
      profileId,
      this.today(),
    );
    await this.ensure(profileId);
    await this.database.runAsync(
      `UPDATE profile_progress SET last_interaction_at = ?,
        last_brushing_at = CASE WHEN ? = 1 THEN ? ELSE last_brushing_at END
       WHERE child_profile_id = ?`,
      timestamp,
      completed ? 1 : 0,
      timestamp,
      profileId,
    );
    return this.get(profileId);
  }
}
