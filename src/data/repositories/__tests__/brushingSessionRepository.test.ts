import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteBrushingSessionRepository } from '../SQLiteBrushingSessionRepository';
import { SQLiteInventoryRepository } from '../SQLiteInventoryRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-sqlite', () => ({}));

async function seedProfile(database: NodeSQLiteDatabase, profileId: string): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO families (id, created_at, locale, timezone)
     VALUES ('family-1', '2026-08-08T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
  );
  await database.runAsync(
    `INSERT INTO child_profiles
      (id, family_id, nickname, age_band, avatar_id, created_at)
     VALUES (?, 'family-1', ?, '4_6', 'inci', '2026-08-08T00:00:00.000Z')`,
    profileId,
    profileId,
  );
}

describe('SQLiteBrushingSessionRepository', () => {
  it.each([
    [new Date(2026, 7, 8, 8, 30), 'morning', 1, 0],
    [new Date(2026, 7, 8, 20, 30), 'evening', 0, 1],
  ] as const)(
    'stores a completed %s session and updates only its period',
    async (completedAt, period, morningCompleted, eveningCompleted) => {
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
        startedAt: '2026-08-08T05:00:00.000Z',
        durationSeconds: 120,
      });

      expect(session).toMatchObject({ completed: true, durationSeconds: 120, period });
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

  it('grants XP once per session and does not advance the same daily slot twice', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1');
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 8, 8, 30),
    );
    const input = {
      sessionId: 'session-idempotent',
      profileId: 'profile-1',
      startedAt: '2026-08-08T05:00:00.000Z',
      durationSeconds: 120,
    };
    const first = await repository.finish(input);
    const duplicate = await repository.finish(input);
    expect(first).toMatchObject({ xpGranted: 20, moodDelta: 5, firstSlotCompletion: true });
    expect(duplicate).toEqual(first);
    await expect(
      database.getFirstAsync<{ count: number; xp: number }>(
        `SELECT count(*) AS count, sum(xp_granted) AS xp FROM brushing_sessions`,
      ),
    ).resolves.toEqual({ count: 1, xp: 20 });

    const repeat = await repository.finish({ ...input, sessionId: 'session-repeat' });
    expect(repeat).toMatchObject({ xpGranted: 10, firstSlotCompletion: false });
    expect(repeat.dailyProgress).toMatchObject({
      morningCompleted: true,
      eveningCompleted: false,
      fullDayCompleted: false,
    });
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

  it('honors an explicit card slot while the primary flow can still use clock time', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'profile-1');
    const repository = new SQLiteBrushingSessionRepository(
      database as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 8, 20, 30),
    );
    const forcedMorning = await repository.finish({
      sessionId: 'forced-morning',
      profileId: 'profile-1',
      startedAt: '2026-08-08T17:00:00.000Z',
      durationSeconds: 120,
      period: 'morning',
    });
    expect(forcedMorning.session.period).toBe('morning');
    expect(forcedMorning.dailyProgress).toMatchObject({
      morningCompleted: true,
      eveningCompleted: false,
    });
    const automaticEvening = await repository.finish({
      sessionId: 'automatic-evening',
      profileId: 'profile-1',
      startedAt: '2026-08-08T17:05:00.000Z',
      durationSeconds: 120,
    });
    expect(automaticEvening.session.period).toBe('evening');
    expect(automaticEvening.dailyProgress.fullDayCompleted).toBe(true);
    database.close();
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
    const reward = new SQLiteBrushingSessionRepository(
      first as unknown as SQLiteDatabase,
      undefined,
      () => new Date(2026, 7, 8, 8, 30),
      async () => 'parent-a',
    );
    for (const sessionId of ['a-1', 'a-2', 'a-3']) {
      await reward.finish({
        sessionId,
        profileId: 'profile-a',
        startedAt: '2026-08-08T05:00:00.000Z',
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
