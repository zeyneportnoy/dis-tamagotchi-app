import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { determineBrushingPeriod, toLocalDateKey } from '@/domain/brushing';
import type { BrushingPeriod, BrushingSession, BrushingSessionRepository } from '@/domain/family';
import {
  FIRST_DAILY_SLOT_BONUS_XP,
  MAX_MOOD,
  SESSION_MOOD_DELTA,
  SESSION_XP,
  levelForXp,
  newlyUnlockedReward,
  nextFullDayStreak,
  previousLocalDayKey,
  rewardItemForKey,
  type BrushingRewardResult,
  type DailyProgress,
  type FinishBrushingSessionInput,
  type RewardSessionRepository,
} from '@/domain/rewards';

type SessionRow = {
  id: string;
  profile_id: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  completed: number;
  period: BrushingPeriod;
  created_at: string;
  reward_granted_at: string | null;
  xp_granted: number;
  mood_delta: number;
  unlocked_item_key: string | null;
  local_day_key: string | null;
  first_slot_completion: number;
  streak_advanced: number;
  morning_completed_after: number;
  evening_completed_after: number;
  streak_after: number;
};

type DailyRow = {
  child_profile_id: string;
  local_day_key: string;
  morning_completed: number;
  evening_completed: number;
  full_day_completed: number;
  streak_after_day: number;
};

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

const mapSession = (row: SessionRow): BrushingSession => ({
  id: row.id,
  profileId: row.profile_id,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  durationSeconds: row.duration_seconds,
  completed: row.completed === 1,
  period: row.period,
  createdAt: row.created_at,
  rewardGrantedAt: row.reward_granted_at,
  xpGranted: row.xp_granted,
  moodDelta: row.mood_delta,
  unlockedItemKey: row.unlocked_item_key,
  localDayKey: row.local_day_key,
});

const mapDaily = (row: DailyRow): DailyProgress => ({
  childProfileId: row.child_profile_id,
  localDayKey: row.local_day_key,
  morningCompleted: row.morning_completed === 1,
  eveningCompleted: row.evening_completed === 1,
  fullDayCompleted: row.full_day_completed === 1,
  streakAfterDay: row.streak_after_day,
});

const mapProgress = (row: ProgressRow) => ({
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

export class SQLiteBrushingSessionRepository
  implements BrushingSessionRepository, RewardSessionRepository
{
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
    private readonly getActiveParentId: () => Promise<string | null> = async () => null,
    private readonly beforeRewardCommit?: () => Promise<void>,
  ) {}

  private async assertOwned(profileId: string): Promise<void> {
    const parentId = await this.getActiveParentId();
    if (!parentId) return;
    const owned = await this.database.getFirstAsync<{ id: string }>(
      `SELECT id FROM child_profiles
       WHERE id = ? AND parent_auth_user_id = ? AND archived_at IS NULL`,
      profileId,
      parentId,
    );
    if (!owned) throw new Error('PROFILE_NOT_FOUND');
  }

  async complete(input: {
    sessionId?: string;
    profileId: string;
    startedAt: string;
    durationSeconds: number;
  }): Promise<BrushingSession> {
    return (
      await this.finish({
        ...input,
        sessionId: input.sessionId ?? this.createId(),
        completed: input.durationSeconds >= 120,
      })
    ).session;
  }

  async finish(input: FinishBrushingSessionInput): Promise<BrushingRewardResult> {
    await this.assertOwned(input.profileId);
    const finishedAt = this.now();
    const finishedAtIso = finishedAt.toISOString();
    const period = input.period ?? determineBrushingPeriod(finishedAt);
    const localDayKey = toLocalDateKey(finishedAt);
    let result: BrushingRewardResult | null = null;

    await this.database.withTransactionAsync(async () => {
      const existing = await this.database.getFirstAsync<SessionRow>(
        'SELECT * FROM brushing_sessions WHERE id = ?',
        input.sessionId,
      );
      if (existing) {
        if (existing.profile_id !== input.profileId) throw new Error('SESSION_PROFILE_MISMATCH');
        result = await this.readResult(existing);
        return;
      }

      const completed = input.completed ?? input.durationSeconds >= 120;
      await this.database.runAsync(
        `INSERT INTO brushing_sessions
          (id, profile_id, started_at, completed_at, duration_seconds, completed, period, created_at,
           local_day_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.sessionId,
        input.profileId,
        input.startedAt,
        finishedAtIso,
        input.durationSeconds,
        completed ? 1 : 0,
        period,
        finishedAtIso,
        localDayKey,
      );

      await this.ensureProgress(input.profileId, localDayKey);
      if (!completed || input.durationSeconds < 120) {
        const session = await this.requireSession(input.sessionId);
        result = await this.readResult(session);
        return;
      }

      await this.database.runAsync(
        `INSERT OR IGNORE INTO daily_progress(child_profile_id, local_day_key)
         VALUES (?, ?)`,
        input.profileId,
        localDayKey,
      );
      const dailyBefore = await this.requireDaily(input.profileId, localDayKey);
      const firstSlotCompletion =
        period === 'morning' ? !dailyBefore.morningCompleted : !dailyBefore.eveningCompleted;
      const morningCompleted = dailyBefore.morningCompleted || period === 'morning';
      const eveningCompleted = dailyBefore.eveningCompleted || period === 'evening';
      const becomesFullDay = !dailyBefore.fullDayCompleted && morningCompleted && eveningCompleted;
      let streakAfterDay = dailyBefore.streakAfterDay;
      if (becomesFullDay) {
        const previous = await this.database.getFirstAsync<DailyRow>(
          `SELECT * FROM daily_progress
           WHERE child_profile_id = ? AND local_day_key = ? AND full_day_completed = 1`,
          input.profileId,
          previousLocalDayKey(localDayKey),
        );
        streakAfterDay = nextFullDayStreak(previous?.streak_after_day ?? null);
      }
      await this.database.runAsync(
        `UPDATE daily_progress SET morning_completed = ?, evening_completed = ?,
          full_day_completed = ?, streak_after_day = ?
         WHERE child_profile_id = ? AND local_day_key = ?`,
        morningCompleted ? 1 : 0,
        eveningCompleted ? 1 : 0,
        morningCompleted && eveningCompleted ? 1 : 0,
        streakAfterDay,
        input.profileId,
        localDayKey,
      );

      const progressBefore = await this.requireProgress(input.profileId);
      const xpGranted = SESSION_XP + (firstSlotCompletion ? FIRST_DAILY_SLOT_BONUS_XP : 0);
      const nextXp = progressBefore.totalXp + xpGranted;
      const moodDelta = Math.min(SESSION_MOOD_DELTA, MAX_MOOD - progressBefore.mood);
      const unlockedItemKey = newlyUnlockedReward(progressBefore.totalXp, nextXp);
      await this.database.runAsync(
        `UPDATE profile_progress SET status_date = ?, morning_completed = ?, evening_completed = ?,
          current_streak = CASE WHEN ? = 1 THEN ? ELSE current_streak END,
          total_xp = ?, level = ?, mood = mood + ?, last_interaction_at = ?, last_brushing_at = ?
         WHERE child_profile_id = ?`,
        localDayKey,
        morningCompleted ? 1 : 0,
        eveningCompleted ? 1 : 0,
        becomesFullDay ? 1 : 0,
        streakAfterDay,
        nextXp,
        levelForXp(nextXp),
        moodDelta,
        finishedAtIso,
        finishedAtIso,
        input.profileId,
      );
      await this.database.runAsync(
        `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
         VALUES (?, 'cozy-scarf', ?, 1, 'decor')`,
        input.profileId,
        finishedAtIso,
      );
      for (const [key, slot] of [
        ['pastel-playroom', 'background'],
        ['bubble-glow', 'effect'],
        ['classic-brush', 'brush'],
      ] as const) {
        await this.database.runAsync(
          `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
           VALUES (?, ?, ?, 1, ?)`,
          input.profileId,
          key,
          finishedAtIso,
          slot,
        );
      }
      if (unlockedItemKey) {
        const unlockedSlot = rewardItemForKey(unlockedItemKey).slot;
        await this.database.runAsync(
          `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, slot)
           VALUES (?, ?, ?, ?)`,
          input.profileId,
          unlockedItemKey,
          finishedAtIso,
          unlockedSlot,
        );
      }
      await this.database.runAsync(
        `UPDATE brushing_sessions SET reward_granted_at = ?, xp_granted = ?, mood_delta = ?,
          unlocked_item_key = ?, first_slot_completion = ?, streak_advanced = ?,
          morning_completed_after = ?, evening_completed_after = ?, streak_after = ?
         WHERE id = ? AND reward_granted_at IS NULL`,
        finishedAtIso,
        xpGranted,
        moodDelta,
        unlockedItemKey,
        firstSlotCompletion ? 1 : 0,
        becomesFullDay ? 1 : 0,
        morningCompleted ? 1 : 0,
        eveningCompleted ? 1 : 0,
        streakAfterDay,
        input.sessionId,
      );
      await this.beforeRewardCommit?.();
      result = await this.readResult(await this.requireSession(input.sessionId));
    });

    if (!result) throw new Error('SESSION_RESULT_NOT_FOUND');
    return result;
  }

  private async ensureProgress(profileId: string, dayKey: string): Promise<void> {
    await this.database.runAsync(
      `INSERT OR IGNORE INTO profile_progress (child_profile_id, status_date) VALUES (?, ?)`,
      profileId,
      dayKey,
    );
  }

  private async requireSession(sessionId: string): Promise<SessionRow> {
    const row = await this.database.getFirstAsync<SessionRow>(
      'SELECT * FROM brushing_sessions WHERE id = ?',
      sessionId,
    );
    if (!row) throw new Error('SESSION_NOT_FOUND');
    return row;
  }

  private async requireDaily(profileId: string, dayKey: string): Promise<DailyProgress> {
    const row = await this.database.getFirstAsync<DailyRow>(
      'SELECT * FROM daily_progress WHERE child_profile_id = ? AND local_day_key = ?',
      profileId,
      dayKey,
    );
    if (!row) throw new Error('DAILY_PROGRESS_NOT_FOUND');
    return mapDaily(row);
  }

  private async requireProgress(profileId: string) {
    const row = await this.database.getFirstAsync<ProgressRow>(
      'SELECT * FROM profile_progress WHERE child_profile_id = ?',
      profileId,
    );
    if (!row) throw new Error('PROFILE_PROGRESS_NOT_FOUND');
    return mapProgress(row);
  }

  private async readResult(sessionRow: SessionRow): Promise<BrushingRewardResult> {
    const session = mapSession(sessionRow);
    const progress = await this.requireProgress(session.profileId);
    const daily = session.localDayKey
      ? await this.database.getFirstAsync<DailyRow>(
          'SELECT * FROM daily_progress WHERE child_profile_id = ? AND local_day_key = ?',
          session.profileId,
          session.localDayKey,
        )
      : null;
    const dailyProgress = session.rewardGrantedAt
      ? {
          childProfileId: session.profileId,
          localDayKey: session.localDayKey ?? '',
          morningCompleted: sessionRow.morning_completed_after === 1,
          eveningCompleted: sessionRow.evening_completed_after === 1,
          fullDayCompleted:
            sessionRow.morning_completed_after === 1 && sessionRow.evening_completed_after === 1,
          streakAfterDay: sessionRow.streak_after,
        }
      : daily
        ? mapDaily(daily)
        : {
            childProfileId: session.profileId,
            localDayKey: session.localDayKey ?? '',
            morningCompleted: false,
            eveningCompleted: false,
            fullDayCompleted: false,
            streakAfterDay: progress.currentStreak,
          };
    return {
      session,
      xpGranted: session.xpGranted,
      moodDelta: session.moodDelta,
      unlockedItemKey: session.unlockedItemKey as BrushingRewardResult['unlockedItemKey'],
      dailyProgress,
      progress,
      firstSlotCompletion: sessionRow.first_slot_completion === 1,
      streakAdvanced: sessionRow.streak_advanced === 1,
    };
  }

  async listCompleted(profileId: string): Promise<readonly BrushingSession[]> {
    await this.assertOwned(profileId);
    const rows = await this.database.getAllAsync<SessionRow>(
      `SELECT * FROM brushing_sessions
       WHERE profile_id = ? AND completed = 1 ORDER BY completed_at`,
      profileId,
    );
    return rows.map(mapSession);
  }
}
