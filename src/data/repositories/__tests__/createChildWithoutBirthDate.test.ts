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

it('never forwards a STALE non-null local dateOfBirth to the cloud on sync/update', async () => {
  // An older device that collected a real date of birth before the product
  // stopped doing so still has one in its local SQLite row. Even then, the
  // cloud payload must never carry date_of_birth — this is the one write path
  // (create AND update both funnel through it via claimLegacyProfiles), so
  // proving it here for a non-null value is what actually locks the rule in.
  const single = jest
    .fn()
    .mockResolvedValue({ data: { id: 'child-1', parent_id: 'parent-1' }, error: null });
  const upsert = jest.fn().mockReturnValue({ select: () => ({ single }) });
  const client = { from: () => ({ upsert }) } as unknown as SupabaseClient;
  await new SupabaseChildProfileRepository(client).upsert({
    id: 'child-1',
    parentId: 'parent-1',
    nickname: 'Ege',
    dateOfBirth: '2018-05-01',
    ageBand: '7_11',
    avatarId: 'inci',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-11T00:00:00Z',
    archivedAt: null,
  });
  const payload = upsert.mock.calls[0]?.[0];
  expect(payload).not.toHaveProperty('date_of_birth');
  expect(payload).toMatchObject({ nickname: 'Ege', age_band: '7_11', avatar_id: 'inci' });
});
