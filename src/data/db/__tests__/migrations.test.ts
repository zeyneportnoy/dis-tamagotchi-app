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
      'active_profile',
      'child_profiles',
      'families',
      'profile_progress',
      'schema_migrations',
    ]);
    database.close();
  });

  it('is safe to run a second time', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const migrations = await database.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations',
    );
    expect(migrations).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }]);
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
      database.getAllAsync<{ age_band: string; id: string; nickname: string }>(
        'SELECT id, nickname, age_band FROM child_profiles ORDER BY id',
      ),
    ).resolves.toEqual([{ age_band: '6_8', id: 'profile-1', nickname: 'Ege' }]);
    await expect(
      database.getFirstAsync<{ child_profile_id: string }>(
        'SELECT child_profile_id FROM active_profile WHERE singleton = 1',
      ),
    ).resolves.toEqual({ child_profile_id: 'profile-1' });
    await expect(
      database.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version',
      ),
    ).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }]);
    database.close();
  });
});
