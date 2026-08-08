import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteBrushingSessionRepository } from '../SQLiteBrushingSessionRepository';

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
     VALUES (?, 'family-1', ?, '4_6', 'cheerful-incisor', '2026-08-08T00:00:00.000Z')`,
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
});
