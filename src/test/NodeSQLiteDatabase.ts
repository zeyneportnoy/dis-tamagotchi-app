import { DatabaseSync, type StatementResultingChanges } from 'node:sqlite';

// `node:sqlite` stopped exporting `SupportedValueType` in newer @types/node; these
// are the bind-parameter primitives it still accepts.
type SupportedValueType = null | number | bigint | string | Uint8Array;

export class NodeSQLiteDatabase {
  private readonly database: DatabaseSync;

  constructor(path = ':memory:') {
    this.database = new DatabaseSync(path);
  }

  execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
    return Promise.resolve();
  }

  getFirstAsync<T>(sql: string, ...params: SupportedValueType[]): Promise<T | null> {
    return Promise.resolve((this.database.prepare(sql).get(...params) as T | undefined) ?? null);
  }

  getAllAsync<T>(sql: string, ...params: SupportedValueType[]): Promise<T[]> {
    return Promise.resolve(this.database.prepare(sql).all(...params) as T[]);
  }

  runAsync(sql: string, ...params: SupportedValueType[]): Promise<StatementResultingChanges> {
    return Promise.resolve(this.database.prepare(sql).run(...params));
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      await task();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}
