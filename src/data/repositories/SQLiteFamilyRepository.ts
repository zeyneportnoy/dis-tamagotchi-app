import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Family, FamilyRepository } from '@/domain/family';

type FamilyRow = {
  id: string;
  created_at: string;
  locale: string;
  timezone: string;
  cloud_account_id: string | null;
};

const mapFamily = (row: FamilyRow): Family => ({
  id: row.id,
  createdAt: row.created_at,
  locale: row.locale,
  timezone: row.timezone,
  cloudAccountId: row.cloud_account_id,
});

export class SQLiteFamilyRepository implements FamilyRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getLocal(): Promise<Family | null> {
    const row = await this.database.getFirstAsync<FamilyRow>(
      'SELECT * FROM families ORDER BY created_at LIMIT 1',
    );
    return row ? mapFamily(row) : null;
  }

  async createLocal(): Promise<Family> {
    const family: Family = {
      id: this.createId(),
      createdAt: this.now(),
      locale: 'tr-TR',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
      cloudAccountId: null,
    };
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `INSERT INTO families(id, created_at, locale, timezone, cloud_account_id)
         VALUES (?, ?, ?, ?, NULL)`,
        family.id,
        family.createdAt,
        family.locale,
        family.timezone,
      );
    });
    return family;
  }
}
