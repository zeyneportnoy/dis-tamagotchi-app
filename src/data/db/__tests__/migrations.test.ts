import type { SQLiteDatabase } from 'expo-sqlite';

import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { migrateDatabase } from '../database';
import { migrations } from '../migrations';

jest.mock('expo-sqlite', () => ({}));

describe('database migrations', () => {
  it('creates the family schema on a clean database', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const tables = await database.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    expect(tables.map((table) => table.name)).toEqual([
      'active_parent_profile',
      'active_profile',
      'brushing_session_attempts',
      'brushing_sessions',
      'brushing_slot_evaluations',
      'child_profiles',
      'daily_progress',
      'dentist_reminders',
      'families',
      'inventory_items',
      'profile_progress',
      'schema_migrations',
    ]);
    await expect(
      database.getAllAsync<{ name: string }>('PRAGMA table_info(inventory_items)'),
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'slot' })]));
    await expect(
      database.getAllAsync<{ name: string }>('PRAGMA table_info(child_profiles)'),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'date_of_birth' })]),
    );
    database.close();
  });

  it('is safe to run a second time', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const migrations = await database.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations',
    );
    expect(migrations).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
      { version: 6 },
      { version: 7 },
      { version: 8 },
      { version: 9 },
      { version: 10 },
      { version: 11 },
      { version: 12 },
      { version: 13 },
      { version: 14 },
      { version: 15 },
      { version: 16 },
      { version: 17 },
      { version: 18 },
    ]);
    database.close();
  });

  it('preserves a legacy profile and active selection across forward migrations', async () => {
    const database = new NodeSQLiteDatabase();
    const initialMigration = migrations[0];
    if (!initialMigration) throw new Error('Migration 1 is required');

    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
    for (const statement of initialMigration.statements) await database.execAsync(statement);
    await database.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      initialMigration.version,
      initialMigration.name,
      '2026-08-02T12:00:00.000Z',
    );
    await database.runAsync(
      `INSERT INTO families (id, created_at, locale, timezone)
       VALUES (?, ?, ?, ?)`,
      'family-1',
      '2026-08-02T12:00:00.000Z',
      'tr',
      'Europe/Istanbul',
    );
    await database.runAsync(
      `INSERT INTO child_profiles
        (id, family_id, nickname, age_band, avatar_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'profile-1',
      'family-1',
      'Ege',
      '6_8',
      'cheerful-incisor',
      '2026-08-02T12:00:00.000Z',
    );
    await database.runAsync(
      'UPDATE active_profile SET child_profile_id = ? WHERE singleton = 1',
      'profile-1',
    );

    await migrateDatabase(database as unknown as SQLiteDatabase);
    await migrateDatabase(database as unknown as SQLiteDatabase);

    await expect(
      database.getAllAsync<{ age_band: string; avatar_id: string; id: string; nickname: string }>(
        'SELECT id, nickname, age_band, avatar_id FROM child_profiles ORDER BY id',
      ),
    ).resolves.toEqual([{ age_band: '6_8', avatar_id: 'inci', id: 'profile-1', nickname: 'Ege' }]);
    await expect(
      database.getFirstAsync<{ child_profile_id: string }>(
        'SELECT child_profile_id FROM active_profile WHERE singleton = 1',
      ),
    ).resolves.toEqual({ child_profile_id: 'profile-1' });
    await expect(
      database.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version',
      ),
    ).resolves.toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
      { version: 6 },
      { version: 7 },
      { version: 8 },
      { version: 9 },
      { version: 10 },
      { version: 11 },
      { version: 12 },
      { version: 13 },
      { version: 14 },
      { version: 15 },
      { version: 16 },
      { version: 17 },
      { version: 18 },
    ]);
    await expect(
      database.getFirstAsync<{
        id: string;
        sync_status: string;
        updated_at: string;
      }>("SELECT id, sync_status, updated_at FROM child_profiles WHERE id = 'profile-1'"),
    ).resolves.toEqual({
      id: 'profile-1',
      sync_status: 'legacy_local',
      updated_at: '2026-08-02T12:00:00.000Z',
    });
    database.close();
  });

  it('upgrades an M3.5 database without losing profile or brushing progress', async () => {
    const database = new NodeSQLiteDatabase();
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
    for (const migration of migrations.slice(0, 7)) {
      for (const statement of migration.statements) await database.execAsync(statement);
      await database.runAsync(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        '2026-08-09T00:00:00.000Z',
      );
    }
    await database.runAsync(
      `INSERT INTO families(id, created_at, locale, timezone)
       VALUES ('family-1', '2026-08-08T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
    );
    await database.runAsync(
      `INSERT INTO child_profiles
        (id, family_id, nickname, age_band, avatar_id, created_at, parent_auth_user_id,
         sync_status, updated_at)
       VALUES ('profile-1', 'family-1', 'Ege', '4_6', 'inci',
         '2026-08-08T00:00:00.000Z', 'parent-1', 'synced', '2026-08-08T00:00:00.000Z')`,
    );
    await database.runAsync(
      `INSERT INTO profile_progress
        (child_profile_id, status_date, morning_completed, evening_completed, current_streak)
       VALUES ('profile-1', '2026-08-08', 1, 0, 3)`,
    );

    await migrateDatabase(database as unknown as SQLiteDatabase);

    await expect(
      database.getFirstAsync<{ nickname: string }>(
        `SELECT nickname FROM child_profiles WHERE id = 'profile-1'`,
      ),
    ).resolves.toEqual({ nickname: 'Ege' });
    await expect(
      database.getFirstAsync<{
        level: number;
        mood: number;
        total_xp: number;
      }>(`SELECT total_xp, level, mood FROM profile_progress WHERE child_profile_id = 'profile-1'`),
    ).resolves.toEqual({ total_xp: 0, level: 1, mood: 50 });
    await expect(
      database.getFirstAsync<{ morning_completed: number; streak_after_day: number }>(
        `SELECT morning_completed, streak_after_day FROM daily_progress
         WHERE child_profile_id = 'profile-1' AND local_day_key = '2026-08-08'`,
      ),
    ).resolves.toEqual({ morning_completed: 1, streak_after_day: 3 });
    database.close();
  });

  it('rolls back the dentist reminder migration when its second statement fails', async () => {
    const database = new NodeSQLiteDatabase();
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
    for (const migration of migrations.slice(0, 14)) {
      for (const statement of migration.statements) await database.execAsync(statement);
      await database.runAsync(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        '2026-08-28T00:00:00.000Z',
      );
    }

    const execute = database.execAsync.bind(database);
    const spy = jest.spyOn(database, 'execAsync').mockImplementation((statement) => {
      if (statement.includes('dentist_reminders_first_due_idx')) {
        return Promise.reject(new Error('INDEX_FAILURE'));
      }
      return execute(statement);
    });

    await expect(migrateDatabase(database as unknown as SQLiteDatabase)).rejects.toThrow(
      'INDEX_FAILURE',
    );
    await expect(
      database.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'dentist_reminders'",
      ),
    ).resolves.toBeNull();
    await expect(
      database.getFirstAsync<{ version: number }>(
        'SELECT version FROM schema_migrations WHERE version = 15',
      ),
    ).resolves.toBeNull();
    spy.mockRestore();
    database.close();
  });

  it('adds a nullable date of birth without changing an existing child profile', async () => {
    const database = new NodeSQLiteDatabase();
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
    for (const migration of migrations.slice(0, 15)) {
      for (const statement of migration.statements) await database.execAsync(statement);
      await database.runAsync(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        '2026-08-29T00:00:00.000Z',
      );
    }
    await database.runAsync(
      `INSERT INTO families(id, created_at, locale, timezone)
       VALUES ('family-1', '2026-08-29T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
    );
    await database.runAsync(
      `INSERT INTO child_profiles
        (id, family_id, nickname, age_band, avatar_id, created_at, parent_auth_user_id,
         sync_status, updated_at)
       VALUES ('profile-1', 'family-1', 'Ege', '4_6', 'inci',
         '2026-08-29T00:00:00.000Z', 'parent-1', 'synced', '2026-08-29T00:00:00.000Z')`,
    );

    await migrateDatabase(database as unknown as SQLiteDatabase);

    await expect(
      database.getFirstAsync<{
        age_band: string;
        date_of_birth: string | null;
        nickname: string;
      }>(`SELECT nickname, age_band, date_of_birth FROM child_profiles WHERE id = 'profile-1'`),
    ).resolves.toEqual({ age_band: '4_6', date_of_birth: null, nickname: 'Ege' });
    database.close();
  });

  it('rolls back the date of birth migration when its index creation fails', async () => {
    const database = new NodeSQLiteDatabase();
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
    for (const migration of migrations.slice(0, 15)) {
      for (const statement of migration.statements) await database.execAsync(statement);
      await database.runAsync(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        '2026-08-29T00:00:00.000Z',
      );
    }

    const execute = database.execAsync.bind(database);
    const spy = jest.spyOn(database, 'execAsync').mockImplementation((statement) => {
      if (statement.includes('child_profiles_date_of_birth_idx')) {
        return Promise.reject(new Error('INDEX_FAILURE'));
      }
      return execute(statement);
    });

    await expect(migrateDatabase(database as unknown as SQLiteDatabase)).rejects.toThrow(
      'INDEX_FAILURE',
    );
    await expect(
      database.getAllAsync<{ name: string }>('PRAGMA table_info(child_profiles)'),
    ).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'date_of_birth' })]),
    );
    await expect(
      database.getFirstAsync<{ version: number }>(
        'SELECT version FROM schema_migrations WHERE version = 16',
      ),
    ).resolves.toBeNull();
    spy.mockRestore();
    database.close();
  });

  it('upgrades existing sessions and makes off-slot classification persistable', async () => {
    const database = new NodeSQLiteDatabase();
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
    for (const migration of migrations.slice(0, 16)) {
      for (const statement of migration.statements) await database.execAsync(statement);
      await database.runAsync(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        '2026-08-29T00:00:00.000Z',
      );
    }
    await database.runAsync(
      `INSERT INTO families(id, created_at, locale, timezone)
       VALUES ('family-1', '2026-08-29T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
    );
    await database.runAsync(
      `INSERT INTO child_profiles
        (id, family_id, nickname, age_band, avatar_id, created_at, updated_at)
       VALUES ('profile-1', 'family-1', 'Ege', '4_6', 'inci',
         '2026-08-29T00:00:00.000Z', '2026-08-29T00:00:00.000Z')`,
    );
    await database.runAsync(
      `INSERT INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period, created_at)
       VALUES ('session-1', 'profile-1', '2026-08-29T05:00:00.000Z',
         '2026-08-29T05:02:00.000Z', 120, 1, 'morning', '2026-08-29T05:02:00.000Z')`,
    );

    await migrateDatabase(database as unknown as SQLiteDatabase);

    await expect(
      database.getFirstAsync<{ id: string; period: string }>(
        `SELECT id, period FROM brushing_sessions WHERE id = 'session-1'`,
      ),
    ).resolves.toEqual({ id: 'session-1', period: 'morning' });
    const periodColumn = await database.getFirstAsync<{ notnull: number }>(
      `SELECT "notnull" FROM pragma_table_info('brushing_sessions') WHERE name = 'period'`,
    );
    expect(periodColumn).toEqual({ notnull: 0 });
    await expect(
      database.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('brushing_session_attempts', 'brushing_slot_evaluations')
         ORDER BY name`,
      ),
    ).resolves.toEqual([
      { name: 'brushing_session_attempts' },
      { name: 'brushing_slot_evaluations' },
    ]);
    database.close();
  });

  it('rolls back the main-slot reconciliation migration when its final index fails', async () => {
    const database = new NodeSQLiteDatabase();
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
    for (const migration of migrations.slice(0, 16)) {
      for (const statement of migration.statements) await database.execAsync(statement);
      await database.runAsync(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        '2026-08-29T00:00:00.000Z',
      );
    }

    const execute = database.execAsync.bind(database);
    const spy = jest.spyOn(database, 'execAsync').mockImplementation((statement) => {
      if (statement.includes('brushing_slot_evaluations_profile_idx')) {
        return Promise.reject(new Error('INDEX_FAILURE'));
      }
      return execute(statement);
    });

    await expect(migrateDatabase(database as unknown as SQLiteDatabase)).rejects.toThrow(
      'INDEX_FAILURE',
    );
    await expect(
      database.getFirstAsync<{ version: number }>(
        'SELECT version FROM schema_migrations WHERE version = 17',
      ),
    ).resolves.toBeNull();
    await expect(
      database.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('brushing_session_attempts', 'brushing_slot_evaluations')`,
      ),
    ).resolves.toEqual([]);
    const periodColumn = await database.getFirstAsync<{ notnull: number }>(
      `SELECT "notnull" FROM pragma_table_info('brushing_sessions') WHERE name = 'period'`,
    );
    expect(periodColumn).toEqual({ notnull: 1 });
    spy.mockRestore();
    database.close();
  });
});
