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
import type { CloudChildPreferences } from '@/domain/sync';
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

  it('reads the real local dentist dates for push, never a fabricated value', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    await expect(repo.readDentistDatesForPush('profile-1')).resolves.toEqual({
      lastVisitDate: null,
      nextAppointmentDate: null,
    });
    await db.runAsync(
      `INSERT INTO dentist_reminders
        (child_profile_id, first_due_at, second_due_at, last_visit_date, next_appointment_date,
         created_at, updated_at)
       VALUES ('profile-1', '2027-02-01T00:00:00.000Z', '2027-08-01T00:00:00.000Z',
         '2026-06-01', '2026-12-01', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    );
    await expect(repo.readDentistDatesForPush('profile-1')).resolves.toEqual({
      lastVisitDate: '2026-06-01',
      nextAppointmentDate: '2026-12-01',
    });
  });

  it('resolves the current nickname for the recovered-dentist notification copy', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    await expect(repo.resolveNickname('profile-1')).resolves.toBe('profile-1');
    await db.runAsync(`UPDATE child_profiles SET nickname = 'Ada' WHERE id = 'profile-1'`);
    await expect(repo.resolveNickname('profile-1')).resolves.toBe('Ada');
  });

  describe('hasLocalCustomization', () => {
    it('is false for a freshly recovered child with no room AsyncStorage and no equipped inventory', async () => {
      const { db, repo } = await build();
      await seedChild(db, 'profile-1');
      await expect(repo.hasLocalCustomization('profile-1')).resolves.toBe(false);
    });

    it('is true once the room-placement AsyncStorage blob exists', async () => {
      const { db, repo } = await build();
      await seedChild(db, 'profile-1');
      await AsyncStorage.setItem(
        customizationStorageKey('profile-1'),
        JSON.stringify({ developerEquipped: {}, placements: {}, selectedRoomMaterials: [], version: 1 }),
      );
      await expect(repo.hasLocalCustomization('profile-1')).resolves.toBe(true);
    });

    it('is true for an equip-only child that has never touched room decor (production inventory_items)', async () => {
      const { db, repo } = await build();
      await seedChild(db, 'profile-1');
      await db.runAsync(
        `INSERT INTO inventory_items (child_profile_id, item_key, unlocked_at, equipped, slot)
         VALUES ('profile-1', 'pastel-playroom', '2026-08-01T00:00:00.000Z', 1, 'background')`,
      );
      await expect(repo.hasLocalCustomization('profile-1')).resolves.toBe(true);
    });

    it('ignores an equipped wearable/decor row — only background/effect/brush count', async () => {
      const { db, repo } = await build();
      await seedChild(db, 'profile-1');
      await db.runAsync(
        `INSERT INTO inventory_items (child_profile_id, item_key, unlocked_at, equipped, slot)
         VALUES ('profile-1', 'cozy-scarf', '2026-08-01T00:00:00.000Z', 1, 'decor')`,
      );
      await expect(repo.hasLocalCustomization('profile-1')).resolves.toBe(false);
    });
  });

  const prefsFixture = (
    overrides: Partial<CloudChildPreferences> = {},
  ): CloudChildPreferences => ({
    childId: 'profile-1',
    selectedBrushId: null,
    selectedBackgroundId: null,
    selectedEffectId: null,
    roomConfiguration: {
      developerEquipped: {},
      placements: { 'pastel-toy-box': { scale: 1, x: 0.4, y: 0.7 } },
      selectedRoomMaterials: ['pastel-toy-box'],
      version: 1,
    },
    voiceGuide: 'gokce',
    morningReminder: { enabled: false, time: null },
    eveningReminder: { enabled: false, time: null },
    dentistReminderEnabled: true,
    dentistLastVisitDate: null,
    dentistNextAppointmentDate: null,
    nicknamePersonalizationEnabled: null,
    ...overrides,
  });

  it('preserves the raw cloud selection and lets the render-time guard keep a locked item inactive', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    // Score 230: star-brush (240) / undersea-room (2200) / magic-dust (1200) all locked.
    await db.runAsync(
      `INSERT INTO profile_progress (child_profile_id, status_date, total_xp) VALUES ('profile-1', '2026-08-29', 230)`,
    );

    await repo.hydrateCustomization(
      'profile-1',
      prefsFixture({
        selectedBrushId: 'star-brush',
        selectedBackgroundId: 'undersea-room',
        selectedEffectId: 'magic-dust',
      }),
    );

    const stored = decodeCustomizationState(
      await AsyncStorage.getItem(customizationStorageKey('profile-1')),
    );
    expect(stored.developerEquipped.brush).toBe('star-brush');
    expect(stored.developerEquipped.background).toBe('undersea-room');
    expect(stored.developerEquipped.effect).toBe('magic-dust');
    expect(stored.selectedRoomMaterials).toEqual(['pastel-toy-box']);

    // Existing current-Mine-Puan guards resolve the locked picks to the safe default…
    expect(effectiveBrushKey(stored.developerEquipped.brush, 230)).toBe(DEFAULT_BRUSH_KEY);
    expect(effectiveBackgroundKey(stored.developerEquipped.background, 230)).toBe(
      DEFAULT_BACKGROUND_KEY,
    );
    expect(effectiveEffectKey(stored.developerEquipped.effect, 230)).toBe(DEFAULT_EFFECT_KEY);
    // …and no locked item was written to the production inventory source of truth.
    const equipped = await db.getAllAsync<{ item_key: string }>(
      `SELECT item_key FROM inventory_items WHERE child_profile_id = 'profile-1' AND equipped = 1`,
    );
    expect(equipped).toEqual([]);
    // Once the balance is high enough the same stored choice activates again.
    expect(effectiveBrushKey(stored.developerEquipped.brush, 5000)).toBe('star-brush');
  });

  it('equips score-unlocked cloud selections into the production inventory source of truth', async () => {
    const { db, repo } = await build();
    await seedChild(db, 'profile-1');
    // Score 1000: pink-brush (80) + rainbow-room (640) unlocked; magic-dust (1200) still locked.
    await db.runAsync(
      `INSERT INTO profile_progress (child_profile_id, status_date, total_xp) VALUES ('profile-1', '2026-08-29', 1000)`,
    );
    // A previously equipped brush that must be replaced by the recovered one.
    await db.runAsync(
      `INSERT INTO inventory_items (child_profile_id, item_key, unlocked_at, equipped, slot)
       VALUES ('profile-1', 'classic-brush', '2026-08-01T00:00:00.000Z', 1, 'brush')`,
    );

    await repo.hydrateCustomization(
      'profile-1',
      prefsFixture({
        selectedBrushId: 'pink-brush',
        selectedBackgroundId: 'rainbow-room',
        selectedEffectId: 'magic-dust',
      }),
    );

    const equipped = await db.getAllAsync<{ item_key: string; slot: string }>(
      `SELECT item_key, slot FROM inventory_items WHERE child_profile_id = 'profile-1' AND equipped = 1 ORDER BY slot`,
    );
    expect(equipped).toEqual([
      { item_key: 'rainbow-room', slot: 'background' },
      { item_key: 'pink-brush', slot: 'brush' },
    ]);
    // The locked effect never got equipped.
    const effectRows = await db.getAllAsync(
      `SELECT 1 FROM inventory_items WHERE child_profile_id = 'profile-1' AND slot = 'effect'`,
    );
    expect(effectRows).toEqual([]);
  });

  describe('customization sync markers (multi-device conflict)', () => {
    it('reports "dirty, never synced" before any push', async () => {
      const { db, repo } = await build();
      await seedChild(db, 'profile-1');
      await AsyncStorage.setItem(
        customizationStorageKey('profile-1'),
        JSON.stringify({
          developerEquipped: { brush: 'star-brush' },
          placements: {},
          selectedRoomMaterials: [],
          version: 1,
        }),
      );
      await expect(repo.readCustomizationSyncMeta('profile-1')).resolves.toEqual({
        syncedAt: null,
        dirty: true,
      });
    });

    it('is clean right after markCustomizationSynced, then dirty once the state changes', async () => {
      const { db, repo } = await build();
      await seedChild(db, 'profile-1');
      const state = {
        developerEquipped: { brush: 'star-brush' },
        placements: {},
        selectedRoomMaterials: ['pastel-toy-box'],
        version: 1,
      };
      await AsyncStorage.setItem(customizationStorageKey('profile-1'), JSON.stringify(state));
      await repo.markCustomizationSynced('profile-1', state);

      const clean = await repo.readCustomizationSyncMeta('profile-1');
      expect(clean.dirty).toBe(false);
      expect(typeof clean.syncedAt).toBe('string');

      // Local edit → now dirty; recovery must not overwrite it.
      await AsyncStorage.setItem(
        customizationStorageKey('profile-1'),
        JSON.stringify({ ...state, developerEquipped: { brush: 'pink-brush' } }),
      );
      await expect(repo.readCustomizationSyncMeta('profile-1')).resolves.toMatchObject({
        dirty: true,
      });
    });
  });
});
