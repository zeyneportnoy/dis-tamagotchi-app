import * as SQLite from 'expo-sqlite';

import { migrations } from './migrations';

const DATABASE_NAME = 'dis-tamagotchi.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export async function migrateDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
  );

  for (const migration of migrations) {
    const applied = await database.getFirstAsync<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      migration.version,
    );
    if (applied) continue;

    await database.withTransactionAsync(async () => {
      for (const statement of migration.statements) await database.execAsync(statement);
      await database.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
}

export async function checkDatabaseHealth(database: SQLite.SQLiteDatabase): Promise<boolean> {
  const result = await database.getFirstAsync<{ ok: number }>('SELECT 1 AS ok');
  return result?.ok === 1;
}

export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();
  await migrateDatabase(database);
  if (!(await checkDatabaseHealth(database))) throw new Error('Database health check failed');
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}
