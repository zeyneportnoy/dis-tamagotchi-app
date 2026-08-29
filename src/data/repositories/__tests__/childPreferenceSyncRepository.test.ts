import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db';
import {
  DEFAULT_BACKGROUND_KEY,
  DEFAULT_BRUSH_KEY,
  DEFAULT_EFFECT_KEY,
  effectiveBackgroundKey,
  effectiveBrushKey,
  effectiveEffectKey,
} from '@/domain/rewards';
import { customizationStorageKey, decodeCustomizationState } from '@/features/customization';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteChildPreferenceSyncRepository } from '../SQLiteChildPreferenceSyncRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-0000000000fc') }));
jest.mock('expo-sqlite', () => ({}));

const asDb = (database: NodeSQLiteDatabase): SQLiteDatabase => database as unknown as SQLiteDatabase;

async function seedChild(
  database: NodeSQLiteDatabase,
  profileId: string,
  opts: { syncStatus?: string; remoteId?: string | null; parentId?: string } = {},
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO families (id, created_at, locale, timezone)
     VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
  );
  await database.runAsync(
    `INSERT INTO child_profiles
      (id, family_id, nickname, age_band, avatar_id, created_at, remote_id, parent_auth_user_id,
       sync_status, updated_at)
     VALUES (?, 'family-1', ?, '4_6', 'inci', '2026-08-01T00:00:00.000Z', ?, ?, ?, '2026-08-01T00:00:00.000Z')`,
    profileId,
    profileId,
    opts.remoteId === undefined ? profileId : opts.remoteId,
    opts.parentId ?? 'parent-1',
    opts.syncStatus ?? 'synced',
  );
}

const build = async () => {
  const db = new NodeSQLiteDatabase();
  await migrateDatabase(asDb(db));
  return { db, repo: new SQLiteChildPreferenceSyncRepository(asDb(db)) };
};

describe('SQLiteChildPreferenceSyncRepository', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('resolves the remote child id and parent user id only for synced profiles', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    await seedChild(db, 'profile-2', { syncStatus: 'pending', remoteId: null });

    await expect(repo.resolveRemoteChildId('profile-1')).resolves.toBe('profile-1');
    await expect(repo.resolveRemoteChildId('profile-2')).resolves.toBeNull();
    await expect(repo.resolveParentUserId('profile-1')).resolves.toBe('parent-1');
    await expect(repo.listSyncedProfileIds()).resolves.toEqual(['profile-1']);
  });

  it('reads the selected items from the customization store', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({
        developerEquipped: { brush: 'star-brush', background: 'cloud-room', effect: 'gold-sparkle' },
        placements: {},
        selectedRoomMaterials: [],
        version: 1,
      }),
    );

    const pushed = await repo.readCustomizationForPush('profile-1');
    expect(pushed.selectedBrushId).toBe('star-brush');
    expect(pushed.selectedBackgroundId).toBe('cloud-room');
    expect(pushed.selectedEffectId).toBe('gold-sparkle');
  });

  it('falls back to the equipped inventory rows when no dev override is stored', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    for (const [key, slot] of [
      ['pink-brush', 'brush'],
      ['cloud-room', 'background'],
    ] as const) {
      await db.runAsync(
        `INSERT INTO inventory_items (child_profile_id, item_key, unlocked_at, equipped, slot)
         VALUES ('profile-1', ?, '2026-08-01T00:00:00.000Z', 1, ?)`,
        key,
        slot,
      );
    }

    const pushed = await repo.readCustomizationForPush('profile-1');
    expect(pushed.selectedBrushId).toBe('pink-brush');
    expect(pushed.selectedBackgroundId).toBe('cloud-room');
    expect(pushed.selectedEffectId).toBeNull();
  });

  it('reports the dentist reminder as enabled once its row exists', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    await expect(repo.dentistReminderEnabled('profile-1')).resolves.toBe(false);
    await db.runAsync(
      `INSERT INTO dentist_reminders
        (child_profile_id, first_due_at, second_due_at, created_at, updated_at)
       VALUES ('profile-1', '2027-02-01T00:00:00.000Z', '2027-08-01T00:00:00.000Z',
         '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    );
    await expect(repo.dentistReminderEnabled('profile-1')).resolves.toBe(true);
  });

  it('hydrates a recovered customization only shape-checked, never activating a locked item', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    await expect(repo.hasLocalCustomization('profile-1')).resolves.toBe(false);

    await repo.hydrateCustomization('profile-1', {
      developerEquipped: { brush: 'star-brush', background: 'undersea-room', effect: 'magic-dust' },
      placements: { 'pastel-toy-box': { scale: 1, x: 0.4, y: 0.7 } },
      selectedRoomMaterials: ['pastel-toy-box'],
      version: 1,
    });

    await expect(repo.hasLocalCustomization('profile-1')).resolves.toBe(true);
    const stored = decodeCustomizationState(
      await AsyncStorage.getItem(customizationStorageKey('profile-1')),
    );
    // The raw choice is preserved…
    expect(stored.developerEquipped.brush).toBe('star-brush');
    expect(stored.developerEquipped.background).toBe('undersea-room');
    expect(stored.developerEquipped.effect).toBe('magic-dust');
    expect(stored.selectedRoomMaterials).toEqual(['pastel-toy-box']);

    // …but the existing current-Mine-Puan guards still resolve locked picks to
    // the safe default (brush 240 / background 2200 / effect 1200 thresholds).
    expect(effectiveBrushKey(stored.developerEquipped.brush, 230)).toBe(DEFAULT_BRUSH_KEY);
    expect(effectiveBackgroundKey(stored.developerEquipped.background, 230)).toBe(
      DEFAULT_BACKGROUND_KEY,
    );
    expect(effectiveEffectKey(stored.developerEquipped.effect, 230)).toBe(DEFAULT_EFFECT_KEY);
    // Once the balance is high enough the same stored choice activates again.
    expect(effectiveBrushKey(stored.developerEquipped.brush, 5000)).toBe('star-brush');
  });
});
