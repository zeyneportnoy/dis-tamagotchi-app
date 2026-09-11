import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteChildProfileRepository } from '../SQLiteChildProfileRepository';
import { SQLiteFamilyRepository } from '../SQLiteFamilyRepository';
import { SupabaseChildProfileRepository } from '../SupabaseChildProfileRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-sqlite', () => ({}));

it('creates a child without a birth-date INSERT column or cloud payload field', async () => {
  const database = new NodeSQLiteDatabase();
  const sqlite = database as unknown as SQLiteDatabase;
  try {
    await migrateDatabase(sqlite);
    const familyId = '00000000-0000-4000-8000-000000000001';
    const id = '00000000-0000-4000-8000-000000000002';
    const parentId = '00000000-0000-4000-8000-000000000003';
    await new SQLiteFamilyRepository(sqlite, () => familyId).createLocal();
    const run = jest.spyOn(sqlite, 'runAsync');
    const profile = await new SQLiteChildProfileRepository(
      sqlite,
      () => id,
      () => '2026-09-11T12:00:00Z',
      async () => parentId,
    ).create({ familyId, nickname: 'Ege', ageBand: '4_6', avatarId: 'inci' });
    const insert = run.mock.calls.find(([sql]) => sql.includes('INSERT INTO child_profiles'));
    expect(insert?.[0]).not.toContain('date_of_birth');
    expect(profile).toMatchObject({ dateOfBirth: null, ageBand: '4_6' });
    expect(
      await sqlite.getFirstAsync('SELECT date_of_birth FROM child_profiles WHERE id = ?', id),
    ).toEqual({ date_of_birth: null });
    const single = jest.fn().mockResolvedValue({ data: { id, parent_id: parentId }, error: null });
    const upsert = jest.fn().mockReturnValue({ select: () => ({ single }) });
    const client = { from: () => ({ upsert }) } as unknown as SupabaseClient;
    await new SupabaseChildProfileRepository(client).upsert({
      id,
      parentId,
      nickname: profile.nickname,
      dateOfBirth: profile.dateOfBirth,
      ageBand: '4_6',
      avatarId: 'inci',
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      archivedAt: null,
    });
    expect(upsert.mock.calls[0]?.[0]).not.toHaveProperty('date_of_birth');
  } finally {
    database.close();
  }
});
