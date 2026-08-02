import type { SQLiteDatabase } from 'expo-sqlite';

import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { migrateDatabase } from '../database';

jest.mock('expo-sqlite', () => ({}));

describe('M1 migrations', () => {
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
    expect(migrations).toEqual([{ version: 1 }]);
    database.close();
  });
});
