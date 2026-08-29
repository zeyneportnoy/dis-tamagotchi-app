import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SQLiteDatabase } from 'expo-sqlite';

import { ChildExperienceUseCases } from '@/application/child';
import { migrateDatabase } from '@/data/db';
import { growthStageForXp } from '@/domain/rewards';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteBrushingSessionRepository } from '../SQLiteBrushingSessionRepository';
import { SQLiteInventoryRepository } from '../SQLiteInventoryRepository';
import { SQLiteProfileProgressRepository } from '../SQLiteProfileProgressRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-sqlite', () => ({}));

async function seedProfile(
  database: NodeSQLiteDatabase,
  profileId: string,
  createdAt = '2026-08-08T00:00:00.000Z',
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO families (id, created_at, locale, timezone)
     VALUES ('family-1', '2026-08-08T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
  );
  await database.runAsync(
    `INSERT INTO child_profiles
      (id, family_id, nickname, age_band, avatar_id, created_at)
     VALUES (?, 'family-1', ?, '4_6', 'inci', ?)`,
    profileId,
    profileId,
    createdAt,
  );
}

describe('SQLiteBrushingSessionRepository', () => {
  it.each([
    [new Date(2026, 7, 8, 8), new Date(2026, 7, 8, 8, 2), 'morning', 1, 0],
    [new Date(2026, 7, 8, 18), new Date(2026, 7, 8, 18, 2), 'evening', 0, 1],
  ] as const)(
    'stores a completed session started at %s in its fixed main slot',
    async (startedAt, completedAt, period, morningCompleted, eveningCompleted) => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(database, 'profile-1');
      const repository = new SQLiteBrushingSessionRepository(
        database as unknown as SQLiteDatabase,
        () => `session-${period}`,
        () => completedAt,
      );
      const session = await repository.complete({
        profileId: 'profile-1',
        startedAt: startedAt.toISOString(),
        durationSeconds: 120,
      });

      expect(session).toMatchObject({
        completed: true,
        durationSeconds: 120,
        period,
        xpGranted: 20,
      });
      await expect(repository.listCompleted('profile-1')).resolves.toEqual([session]);
      await expect(
        database.getFirstAsync<{
          last_brushing_at: string;
          last_interaction_at: string;
          morning_completed: number;
          evening_completed: number;
        }>('SELECT * FROM profile_progress WHERE child_profile_id = ?', 'profile-1'),
      ).resolves.toMatchObject({
        morning_completed: morningCompleted,
        evening_completed: eveningCompleted,
        last_brushing_at: completedAt.toISOString(),
        last_interaction_at: completedAt.toISOString(),
      });
      database.close();
    },
  );

  it('persists after reopen and keeps profile histories isolated', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dis-tamagotchi-session-db-'));
    const path = join(directory, 'test.db');
    const first = new NodeSQLiteDatabase(path);
    await migrateDatabase(first as unknown as SQLiteDatabase);
    await seedProfile(first, 'profile-1');
    await seedProfile(first, 'profile-2');
    let id = 0;
    const repository = new SQLiteBrushingSessionRepository(
      first as unknown as SQLiteDatabase,
      () => `session-${++id}`,
      () => new Date(2026, 7, 8, 8, 30),
    );
    for (const profileId of ['profile-1', 'profile-2']) {
      await repository.complete({
        profileId,
        startedAt: '2026-08-08T05:00:00.000Z',
        durationSeconds: 120,
      });
    }
    first.close();

    const reopened = new NodeSQLiteDatabase(path);
    await migrateDatabase(reopened as unknown as SQLiteDatabase);
    const reopenedRepository = new SQLiteBrushingSessionRepository(
      reopened as unknown as SQLiteDatabase,
    );
    await expect(reopenedRepository.listCompleted('profile-1')).resolves.toHaveLength(1);
    await expect(reopenedRepository.listCompleted('profile-2')).resolves.toHaveLength(1);
    await expect(
      reopened.getFirstAsync<{ morning_completed: number; last_brushing_at: string }>(
        'SELECT morning_completed, last_brushing_at FROM profile_progress WHERE child_profile_id = ?',
        'profile-1',
      ),
    ).resolves.toMatchObject({
      morning_completed: 1,
      last_brushing_at: new Date(2026, 7, 8, 8, 30).toISOString(),
    });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('rewards each child/day/main slot once and gives repeated slots no progress or unlocks', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1');
    await database.runAsync(
      `INSERT INTO profile_progress(child_profile_id, status_date, total_xp)
       VALUES ('profile-1', '2026-08-08', 70)`,
    );
    let now = new Date(2026, 7, 8, 8, 2);
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => now,
    );
    const morningInput = {
      sessionId: 'morning-08-00',
      profileId: 'profile-1',
      startedAt: new Date(2026, 7, 8, 8).toISOString(),
      durationSeconds: 120,
    };
    const firstMorning = await repository.finish(morningInput);
    const duplicateSession = await repository.finish(morningInput);
    expect(firstMorning).toMatchObject({
      firstSlotCompletion: true,
      moodDelta: 5,
      unlockedItemKey: 'star-crown',
      xpGranted: 20,
    });
    expect(duplicateSession).toEqual(firstMorning);
    const inventoryAfterFirstMorning = await database.getFirstAsync<{ count: number }>(
      `SELECT count(*) AS count FROM inventory_items WHERE child_profile_id = 'profile-1'`,
    );

    now = new Date(2026, 7, 8, 10, 2);
    const repeatMorning = await repository.finish({
      ...morningInput,
      sessionId: 'morning-10-00',
      startedAt: new Date(2026, 7, 8, 10).toISOString(),
    });
    expect(repeatMorning).toMatchObject({
      firstSlotCompletion: false,
      streakAdvanced: false,
      unlockedItemKey: null,
      xpGranted: 0,
    });
    await expect(
      database.getFirstAsync<{ current_streak: number; total_xp: number }>(
        `SELECT current_streak, total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ current_streak: 0, total_xp: 90 });
    await expect(
      database.getFirstAsync<{ count: number }>(
        `SELECT count(*) AS count FROM inventory_items WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual(inventoryAfterFirstMorning);

    now = new Date(2026, 7, 8, 19, 2);
    const firstEvening = await repository.finish({
      sessionId: 'evening-19-00',
      profileId: 'profile-1',
      startedAt: new Date(2026, 7, 8, 19).toISOString(),
      durationSeconds: 120,
    });
    expect(firstEvening).toMatchObject({
      firstSlotCompletion: true,
      streakAdvanced: true,
      unlockedItemKey: 'cloud-room',
      xpGranted: 20,
    });
    const inventoryAfterFirstEvening = await database.getFirstAsync<{ count: number }>(
      `SELECT count(*) AS count FROM inventory_items WHERE child_profile_id = 'profile-1'`,
    );

    now = new Date(2026, 7, 8, 21, 2);
    const repeatEvening = await repository.finish({
      sessionId: 'evening-21-00',
      profileId: 'profile-1',
      startedAt: new Date(2026, 7, 8, 21).toISOString(),
      durationSeconds: 120,
    });
    expect(repeatEvening).toMatchObject({
      firstSlotCompletion: false,
      streakAdvanced: false,
      unlockedItemKey: null,
      xpGranted: 0,
    });
    await expect(
      database.getFirstAsync<{ current_streak: number; total_xp: number }>(
        `SELECT current_streak, total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ current_streak: 1, total_xp: 110 });
    await expect(
      database.getFirstAsync<{ count: number }>(
        `SELECT count(*) AS count FROM inventory_items WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual(inventoryAfterFirstEvening);

    now = new Date(2026, 7, 9, 8, 2);
    const nextDayMorning = await repository.finish({
      sessionId: 'next-day-morning-08-00',
      profileId: 'profile-1',
      startedAt: new Date(2026, 7, 9, 8).toISOString(),
      durationSeconds: 120,
    });
    expect(nextDayMorning).toMatchObject({ firstSlotCompletion: true, xpGranted: 20 });
    await expect(
      database.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ total_xp: 130 });
    database.close();
  });

  it('creates full day and advances streak only once after morning and evening', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1');
    let now = new Date(2026, 7, 8, 8, 30);
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => now,
    );
    await repository.finish({
      sessionId: 'morning-1',
      profileId: 'profile-1',
      startedAt: now.toISOString(),
      durationSeconds: 120,
    });
    now = new Date(2026, 7, 8, 20, 30);
    const evening = await repository.finish({
      sessionId: 'evening-1',
      profileId: 'profile-1',
      startedAt: now.toISOString(),
      durationSeconds: 120,
    });
    expect(evening.dailyProgress).toMatchObject({
      morningCompleted: true,
      eveningCompleted: true,
      fullDayCompleted: true,
      streakAfterDay: 1,
    });
    expect(evening.streakAdvanced).toBe(true);
    await repository.finish({
      sessionId: 'evening-2',
      profileId: 'profile-1',
      startedAt: now.toISOString(),
      durationSeconds: 120,
    });
    await expect(
      database.getFirstAsync<{ current_streak: number }>(
        `SELECT current_streak FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ current_streak: 1 });

    now = new Date(2026, 7, 9, 8, 30);
    await repository.finish({
      sessionId: 'next-morning',
      profileId: 'profile-1',
      startedAt: now.toISOString(),
      durationSeconds: 120,
    });
    now = new Date(2026, 7, 9, 20, 30);
    const nextEvening = await repository.finish({
      sessionId: 'next-evening',
      profileId: 'profile-1',
      startedAt: now.toISOString(),
      durationSeconds: 120,
    });
    expect(nextEvening.dailyProgress.streakAfterDay).toBe(2);
    database.close();
  });

  it('does not grant a full reward for a partial session', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1');
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 8, 8, 30),
    );
    const result = await repository.finish({
      sessionId: 'partial-1',
      profileId: 'profile-1',
      startedAt: '2026-08-08T05:00:00.000Z',
      durationSeconds: 119,
      completed: false,
    });
    expect(result).toMatchObject({ xpGranted: 0, moodDelta: 0, unlockedItemKey: null });
    expect(result.session.completed).toBe(false);
    expect(result.dailyProgress).toMatchObject({
      morningCompleted: false,
      eveningCompleted: false,
    });
    database.close();
  });

  it.each([
    new Date(2026, 7, 8, 12),
    new Date(2026, 7, 8, 13),
    new Date(2026, 7, 8, 16),
    new Date(2026, 7, 8, 17, 59),
  ])('gives zero reward to an off-slot session started at %s', async (startedAt) => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1');
    const finishedAt = new Date(startedAt.getTime() + 120_000);
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => finishedAt,
    );
    const offSlot = await repository.finish({
      sessionId: `off-slot-${startedAt.getHours()}-${startedAt.getMinutes()}`,
      profileId: 'profile-1',
      startedAt: startedAt.toISOString(),
      durationSeconds: 120,
    });
    expect(offSlot.session.period).toBeNull();
    expect(offSlot).toMatchObject({ xpGranted: 0, firstSlotCompletion: false });
    expect(offSlot.dailyProgress).toMatchObject({
      morningCompleted: false,
      eveningCompleted: false,
    });
    await expect(
      database.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ total_xp: 0 });
    database.close();
  });

  it.each([
    [new Date(2026, 7, 8, 11, 59), new Date(2026, 7, 8, 12, 1), 'morning'],
    [new Date(2026, 7, 8, 23, 59), new Date(2026, 7, 9, 0, 1), 'evening'],
  ] as const)(
    'counts a session started at %s and completed at %s as the original %s slot',
    async (startedAt, finishedAt, period) => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(
        database,
        'profile-1',
        new Date(
          startedAt.getFullYear(),
          startedAt.getMonth(),
          startedAt.getDate(),
          period === 'morning' ? 4 : 18,
        ).toISOString(),
      );
      const repository = new SQLiteBrushingSessionRepository(
        database as unknown as SQLiteDatabase,
        undefined,
        () => finishedAt,
      );
      const result = await repository.finish({
        sessionId: `cross-${period}`,
        profileId: 'profile-1',
        startedAt: startedAt.toISOString(),
        durationSeconds: 120,
      });

      expect(result.session).toMatchObject({
        localDayKey: '2026-08-08',
        period,
      });
      expect(result.dailyProgress).toMatchObject({
        morningCompleted: period === 'morning',
        eveningCompleted: period === 'evening',
      });
      await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([
        expect.objectContaining({ outcome: 'completed', penaltyAmount: 0, period }),
      ]);
      await expect(
        database.getFirstAsync<{ total_xp: number }>(
          `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
        ),
      ).resolves.toEqual({ total_xp: 20 });
      database.close();
    },
  );

  it('applies morning and evening missed penalties once each', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1', new Date(2026, 7, 8, 4).toISOString());
    await database.runAsync(
      `INSERT INTO profile_progress(child_profile_id, status_date, total_xp)
       VALUES ('profile-1', '2026-08-08', 30)`,
    );
    let now = new Date(2026, 7, 8, 11, 59, 59);
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => now,
    );

    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([]);
    now = new Date(2026, 7, 8, 12);
    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([
      expect.objectContaining({
        outcome: 'missed',
        penaltyAmount: -10,
        period: 'morning',
        scoreAfter: 20,
        scoreBefore: 30,
      }),
    ]);
    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([]);

    now = new Date(2026, 7, 9, 0);
    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([
      expect.objectContaining({
        outcome: 'missed',
        penaltyAmount: -10,
        period: 'evening',
        scoreAfter: 10,
        scoreBefore: 20,
      }),
    ]);
    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([]);
    await expect(
      database.getFirstAsync<{ count: number; total_xp: number }>(
        `SELECT
          (SELECT count(*) FROM brushing_slot_evaluations
           WHERE child_profile_id = 'profile-1' AND outcome = 'missed') AS count,
          total_xp
         FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ count: 2, total_xp: 10 });
    database.close();
  });

  it('does not create retroactive evaluations for slots closed before profile creation', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const createdAt = new Date(2026, 7, 8, 13);
    await seedProfile(database, 'profile-1', createdAt.toISOString());
    await database.runAsync(
      `INSERT INTO profile_progress(child_profile_id, status_date, total_xp)
       VALUES ('profile-1', '2026-08-08', 50)`,
    );
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 9, 12),
    );

    await repository.reconcileMissedSlots('profile-1');
    await expect(
      database.getAllAsync<{ local_day_key: string; period: string }>(
        `SELECT local_day_key, period FROM brushing_slot_evaluations
         WHERE child_profile_id = 'profile-1' ORDER BY local_day_key, period`,
      ),
    ).resolves.toEqual([
      { local_day_key: '2026-08-08', period: 'evening' },
      { local_day_key: '2026-08-09', period: 'morning' },
    ]);
    await expect(
      database.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ total_xp: 30 });
    database.close();
  });

  it('keeps score at zero while recording the fixed missed-slot penalty once', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1', new Date(2026, 7, 8, 4).toISOString());
    await database.runAsync(
      `INSERT INTO profile_progress(child_profile_id, status_date, total_xp)
       VALUES ('profile-1', '2026-08-08', 5)`,
    );
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 8, 12),
    );

    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([
      expect.objectContaining({
        penaltyAmount: -10,
        scoreAfter: 0,
        scoreBefore: 5,
      }),
    ]);
    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([]);
    await expect(
      database.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ total_xp: 0 });
    database.close();
  });

  it.each([
    [405, 395, 2, 1],
    [165, 155, 1, 0],
  ] as const)(
    'moves the character stage backward when a penalty changes %i to %i',
    async (scoreBefore, scoreAfter, stageBefore, stageAfter) => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(database, 'profile-1', new Date(2026, 7, 8, 4).toISOString());
      await database.runAsync(
        `INSERT INTO profile_progress(child_profile_id, status_date, total_xp, level)
         VALUES ('profile-1', '2026-08-08', ?, ?)`,
        scoreBefore,
        scoreBefore >= 400 ? 2 : 1,
      );
      const repository = new SQLiteBrushingSessionRepository(
        database as unknown as SQLiteDatabase,
        undefined,
        () => new Date(2026, 7, 8, 12),
      );

      expect(growthStageForXp(scoreBefore)).toBe(stageBefore);
      await repository.reconcileMissedSlots('profile-1');
      const progress = await database.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      );
      expect(progress?.total_xp).toBe(scoreAfter);
      expect(growthStageForXp(progress?.total_xp ?? 0)).toBe(stageAfter);
      database.close();
    },
  );

  it('defers a closed-slot penalty while its started session is still active', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1', new Date(2026, 7, 8, 4).toISOString());
    await database.runAsync(
      `INSERT INTO profile_progress(child_profile_id, status_date, total_xp)
       VALUES ('profile-1', '2026-08-08', 100)`,
    );
    const startedAt = new Date(2026, 7, 8, 11, 59);
    let now = startedAt;
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => now,
    );
    await repository.begin({
      sessionId: 'active-at-close',
      profileId: 'profile-1',
      startedAt: startedAt.toISOString(),
    });

    now = new Date(2026, 7, 8, 12);
    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([]);
    await expect(
      database.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ total_xp: 100 });

    now = new Date(2026, 7, 8, 12, 1);
    await repository.finish({
      sessionId: 'active-at-close',
      profileId: 'profile-1',
      startedAt: startedAt.toISOString(),
      durationSeconds: 120,
    });
    await expect(repository.reconcileMissedSlots('profile-1')).resolves.toEqual([
      expect.objectContaining({ outcome: 'completed', penaltyAmount: 0, period: 'morning' }),
    ]);
    await expect(
      database.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM profile_progress WHERE child_profile_id = 'profile-1'`,
      ),
    ).resolves.toEqual({ total_xp: 120 });
    database.close();
  });

  it('reconciles a closed unevaluated slot after the app database is reopened', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dis-tamagotchi-reconciliation-db-'));
    const path = join(directory, 'test.db');
    const first = new NodeSQLiteDatabase(path);
    await migrateDatabase(first as unknown as SQLiteDatabase);
    const startedAt = new Date(2026, 7, 8, 11, 59);
    await seedProfile(first, 'profile-1', new Date(2026, 7, 8, 4).toISOString());
    await first.runAsync(
      `INSERT INTO profile_progress(child_profile_id, status_date, total_xp)
       VALUES ('profile-1', '2026-08-08', 30)`,
    );
    const firstRepository = new SQLiteBrushingSessionRepository(
      first as unknown as SQLiteDatabase,
      undefined,
      () => startedAt,
    );
    await firstRepository.begin({
      sessionId: 'interrupted-by-close',
      profileId: 'profile-1',
      startedAt: startedAt.toISOString(),
    });
    first.close();

    const reopened = new NodeSQLiteDatabase(path);
    const reopenedAt = new Date(2026, 7, 8, 12, 5);
    const reopenedRepository = new SQLiteBrushingSessionRepository(
      reopened as unknown as SQLiteDatabase,
      undefined,
      () => reopenedAt,
    );
    const useCases = new ChildExperienceUseCases(
      new SQLiteProfileProgressRepository(reopened as unknown as SQLiteDatabase, () => reopenedAt),
      reopenedRepository,
      new SQLiteInventoryRepository(reopened as unknown as SQLiteDatabase, async () => null),
    );
    await expect(useCases.getProgress('profile-1')).resolves.toMatchObject({ totalXp: 20 });
    await expect(useCases.getProgress('profile-1')).resolves.toMatchObject({ totalXp: 20 });
    await expect(
      reopened.getFirstAsync<{
        outcome: string;
        penalty_amount: number;
        period: string;
        score_after: number;
      }>(
        `SELECT outcome, penalty_amount, period, score_after FROM brushing_slot_evaluations
         WHERE child_profile_id = 'profile-1' AND local_day_key = '2026-08-08'`,
      ),
    ).resolves.toEqual({
      outcome: 'missed',
      penalty_amount: -10,
      period: 'morning',
      score_after: 20,
    });
    await expect(
      reopened.getFirstAsync<{ completed: number; resolved_at: string }>(
        `SELECT completed, resolved_at FROM brushing_session_attempts
         WHERE session_id = 'interrupted-by-close'`,
      ),
    ).resolves.toMatchObject({ completed: 0 });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('rolls back session, XP, daily progress and inventory when the transaction fails', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1');
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 8, 8, 30),
      undefined,
      () => Promise.reject(new Error('forced failure')),
    );
    await expect(
      repository.finish({
        sessionId: 'rollback-1',
        profileId: 'profile-1',
        startedAt: '2026-08-08T05:00:00.000Z',
        durationSeconds: 120,
      }),
    ).rejects.toThrow('forced failure');
    await expect(
      database.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM brushing_sessions'),
    ).resolves.toEqual({ count: 0 });
    await expect(
      database.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM daily_progress'),
    ).resolves.toEqual({ count: 0 });
    await expect(
      database.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM inventory_items'),
    ).resolves.toEqual({ count: 0 });
    database.close();
  });

  it('persists unlock/equip and isolates inventory by parent ownership', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dis-tamagotchi-inventory-db-'));
    const path = join(directory, 'test.db');
    const first = new NodeSQLiteDatabase(path);
    await migrateDatabase(first as unknown as SQLiteDatabase);
    await seedProfile(first, 'profile-a');
    await seedProfile(first, 'profile-b');
    await first.runAsync(
      `UPDATE child_profiles SET parent_auth_user_id = 'parent-a', sync_status = 'synced'
       WHERE id = 'profile-a'`,
    );
    await first.runAsync(
      `UPDATE child_profiles SET parent_auth_user_id = 'parent-b', sync_status = 'synced'
       WHERE id = 'profile-b'`,
    );
    let rewardNow = new Date(2026, 7, 8, 9, 2);
    const reward = new SQLiteBrushingSessionRepository(
      first as unknown as SQLiteDatabase,
      undefined,
      () => rewardNow,
      async () => 'parent-a',
    );
    for (const [sessionId, startedAt, finishedAt] of [
      ['a-1', new Date(2026, 7, 8, 9), new Date(2026, 7, 8, 9, 2)],
      ['a-2', new Date(2026, 7, 8, 11), new Date(2026, 7, 8, 11, 2)],
      ['a-3', new Date(2026, 7, 8, 19), new Date(2026, 7, 8, 19, 2)],
    ] as const) {
      rewardNow = finishedAt;
      await reward.finish({
        sessionId,
        profileId: 'profile-a',
        startedAt: startedAt.toISOString(),
        durationSeconds: 120,
      });
    }
    await expect(
      first.getFirstAsync<{ count: number }>(
        `SELECT count(*) AS count FROM inventory_items WHERE child_profile_id = 'profile-a'`,
      ),
    ).resolves.toEqual({ count: 5 });
    const blockedReward = new SQLiteBrushingSessionRepository(
      first as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 8, 8, 30),
      async () => 'parent-b',
    );
    await expect(
      blockedReward.finish({
        sessionId: 'blocked',
        profileId: 'profile-a',
        startedAt: '2026-08-08T05:00:00.000Z',
        durationSeconds: 120,
      }),
    ).rejects.toThrow('PROFILE_NOT_FOUND');
    const inventoryA = new SQLiteInventoryRepository(
      first as unknown as SQLiteDatabase,
      async () => 'parent-a',
    );
    await expect(inventoryA.equip('profile-a', 'rainbow-cape')).rejects.toThrow('ITEM_LOCKED');
    await inventoryA.equip('profile-a', 'sparkle-crown');
    await expect(inventoryA.getEquippedItems('profile-a')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'cozy-scarf', slot: 'decor' }),
        expect.objectContaining({ key: 'sparkle-crown', slot: 'wearable' }),
      ]),
    );
    await first.runAsync(
      `INSERT INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
       VALUES ('profile-a', 'star-crown', '2026-08-08T09:00:00.000Z', 0, 'wearable')`,
    );
    await inventoryA.equip('profile-a', 'star-crown');
    await expect(inventoryA.getEquippedItems('profile-a')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'cozy-scarf', equipped: true }),
        expect.objectContaining({ key: 'star-crown', equipped: true }),
      ]),
    );
    await expect(inventoryA.list('profile-a')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'sparkle-crown', equipped: false })]),
    );
    await inventoryA.unequipSlot('profile-a', 'wearable');
    await expect(inventoryA.getEquippedItems('profile-a')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'cozy-scarf', slot: 'decor' }),
        expect.objectContaining({ key: 'pastel-playroom', slot: 'background' }),
        expect.objectContaining({ key: 'bubble-glow', slot: 'effect' }),
        expect.objectContaining({ key: 'classic-brush', slot: 'brush' }),
      ]),
    );
    await inventoryA.equip('profile-a', 'sparkle-crown');
    const inventoryB = new SQLiteInventoryRepository(
      first as unknown as SQLiteDatabase,
      async () => 'parent-b',
    );
    await expect(inventoryB.list('profile-a')).rejects.toThrow('PROFILE_NOT_FOUND');
    first.close();

    const reopened = new NodeSQLiteDatabase(path);
    const reopenedInventory = new SQLiteInventoryRepository(
      reopened as unknown as SQLiteDatabase,
      async () => 'parent-a',
    );
    await expect(reopenedInventory.getEquippedItems('profile-a')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'cozy-scarf', slot: 'decor' }),
        expect.objectContaining({ key: 'sparkle-crown', slot: 'wearable' }),
      ]),
    );
    await expect(
      reopened.getFirstAsync<{ mood: number; total_xp: number }>(
        `SELECT total_xp, mood FROM profile_progress WHERE child_profile_id = 'profile-a'`,
      ),
    ).resolves.toEqual({ total_xp: 40, mood: 65 });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
