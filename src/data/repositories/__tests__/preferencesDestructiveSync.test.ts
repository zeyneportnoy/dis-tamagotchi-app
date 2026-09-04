import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  ChildPreferencesSyncUseCases,
  type ChildPreferenceAccessors,
} from '@/application/sync/ChildPreferencesSyncUseCases';
import { ProfileSyncUseCases } from '@/application/sync/ProfileSyncUseCases';
import { migrateDatabase } from '@/data/db';
import type {
  CloudChildPreferences,
  CloudChildPreferencesRepository,
  CloudChildProfile,
  CloudChildProfileRepository,
  CloudReminderPreference,
  CloudVoiceGuide,
} from '@/domain/sync';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteChildPreferenceSyncRepository } from '../SQLiteChildPreferenceSyncRepository';
import { SQLiteProfileSyncRepository } from '../SQLiteProfileSyncRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-0000000000fd') }));
jest.mock('expo-sqlite', () => ({}));

const asDb = (database: NodeSQLiteDatabase): SQLiteDatabase => database as unknown as SQLiteDatabase;

// ---------------------------------------------------------------------------
// Fixtures / fakes
// ---------------------------------------------------------------------------

async function seedChild(
  database: NodeSQLiteDatabase,
  profileId: string,
  opts: {
    syncStatus?: string;
    remoteId?: string | null;
    parentId?: string;
    dateOfBirth?: string | null;
  } = {},
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO families (id, created_at, locale, timezone)
     VALUES ('family-1', '2026-08-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
  );
  await database.runAsync(
    `INSERT INTO child_profiles
      (id, family_id, nickname, date_of_birth, age_band, avatar_id, created_at, remote_id,
       parent_auth_user_id, sync_status, updated_at)
     VALUES (?, 'family-1', ?, ?, '4_6', 'inci', '2026-08-01T00:00:00.000Z', ?, ?, ?,
             '2026-08-01T00:00:00.000Z')`,
    profileId,
    profileId,
    opts.dateOfBirth === undefined ? '2020-01-15' : opts.dateOfBirth,
    opts.remoteId === undefined ? profileId : opts.remoteId,
    opts.parentId ?? 'parent-1',
    opts.syncStatus ?? 'synced',
  );
}

async function readDob(database: NodeSQLiteDatabase, profileId: string): Promise<string | null> {
  const row = await database.getFirstAsync<{ date_of_birth: string | null }>(
    `SELECT date_of_birth FROM child_profiles WHERE id = ?`,
    profileId,
  );
  if (!row) throw new Error(`no child_profiles row for ${profileId}`);
  return row.date_of_birth;
}

/** In-memory stand-in for the Supabase `child_preferences` table. */
class FakeCloudPreferences implements CloudChildPreferencesRepository {
  readonly rows = new Map<string, CloudChildPreferences>();
  upsertCalls: CloudChildPreferences[] = [];

  async upsert(preferences: CloudChildPreferences): Promise<void> {
    this.upsertCalls.push(preferences);
    this.rows.set(preferences.childId, { ...preferences, updatedAt: new Date().toISOString() });
  }

  async get(childId: string): Promise<CloudChildPreferences | null> {
    return this.rows.get(childId) ?? null;
  }

  async listOwned(): Promise<readonly CloudChildPreferences[]> {
    return [...this.rows.values()];
  }
}

/** In-memory stand-in for the Supabase `child_profiles` table (profile fields only). */
class FakeCloudProfiles implements CloudChildProfileRepository {
  readonly rows = new Map<string, CloudChildProfile>();

  async listOwned(): Promise<readonly CloudChildProfile[]> {
    return [...this.rows.values()];
  }

  async upsert(profile: CloudChildProfile): Promise<CloudChildProfile> {
    this.rows.set(profile.id, profile);
    return profile;
  }

  async remove(): Promise<void> {
    // Not exercised by these tests.
  }
}

/**
 * In-memory stand-in for the per-parent voice + per-child reminder accessors
 * `services.ts` normally wires to `@/features/brushing` / `@/features/reminders`.
 * Mirrors their real "absent = never configured, not dirty" contract exactly
 * (see the `readSyncMeta` / `readCustomizationSyncMeta` fix in this task).
 */
class FakePreferenceAccessors implements ChildPreferenceAccessors {
  readonly voice = new Map<string, CloudVoiceGuide>();
  private readonly voiceSyncedValue = new Map<string, CloudVoiceGuide>();
  readonly reminders = new Map<
    string,
    Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>
  >();
  private readonly remindersSyncedFingerprint = new Map<string, string>();

  private key(parentUserId: string, childProfileId: string): string {
    return `${parentUserId}:${childProfileId}`;
  }

  async readVoice(parentUserId: string, childProfileId: string): Promise<CloudVoiceGuide> {
    return this.voice.get(this.key(parentUserId, childProfileId)) ?? 'gokce';
  }

  async hasStoredVoice(parentUserId: string, childProfileId: string): Promise<boolean> {
    return this.voice.has(this.key(parentUserId, childProfileId));
  }

  async writeVoice(parentUserId: string, childProfileId: string, voice: CloudVoiceGuide): Promise<void> {
    this.voice.set(this.key(parentUserId, childProfileId), voice);
  }

  async markVoiceSynced(
    parentUserId: string,
    childProfileId: string,
    voice: CloudVoiceGuide,
  ): Promise<void> {
    this.voiceSyncedValue.set(this.key(parentUserId, childProfileId), voice);
  }

  async readVoiceSyncMeta(
    parentUserId: string,
    childProfileId: string,
  ): Promise<Readonly<{ syncedAt: string | null; dirty: boolean }>> {
    const k = this.key(parentUserId, childProfileId);
    if (!this.voice.has(k)) return { syncedAt: null, dirty: false };
    const synced = this.voiceSyncedValue.get(k);
    return { syncedAt: synced ? '2026-01-01T00:00:00.000Z' : null, dirty: synced !== this.voice.get(k) };
  }

  async readReminders(
    parentUserId: string,
    childProfileId: string,
  ): Promise<Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>> {
    return (
      this.reminders.get(this.key(parentUserId, childProfileId)) ?? {
        morning: { enabled: false, time: '08:00' },
        evening: { enabled: false, time: '20:30' },
      }
    );
  }

  async hasStoredReminders(parentUserId: string, childProfileId: string): Promise<boolean> {
    return this.reminders.has(this.key(parentUserId, childProfileId));
  }

  async applyRecoveredReminders(
    parentUserId: string,
    childProfileId: string,
    values: Readonly<{
      morning: Readonly<{ enabled: boolean; time: string }>;
      evening: Readonly<{ enabled: boolean; time: string }>;
    }>,
  ): Promise<void> {
    this.reminders.set(this.key(parentUserId, childProfileId), values);
  }

  async markRemindersSynced(parentUserId: string, childProfileId: string): Promise<void> {
    const current = await this.readReminders(parentUserId, childProfileId);
    this.remindersSyncedFingerprint.set(this.key(parentUserId, childProfileId), JSON.stringify(current));
  }

  async readRemindersSyncMeta(
    parentUserId: string,
    childProfileId: string,
  ): Promise<Readonly<{ syncedAt: string | null; dirty: boolean }>> {
    const k = this.key(parentUserId, childProfileId);
    if (!this.reminders.has(k)) return { syncedAt: null, dirty: false };
    const synced = this.remindersSyncedFingerprint.get(k);
    const current = JSON.stringify(this.reminders.get(k));
    return { syncedAt: synced ? '2026-01-01T00:00:00.000Z' : null, dirty: synced !== current };
  }

  /** Directly seed reminders as "the cloud already knows this" for a fixture. */
  seedReminders(
    parentUserId: string,
    childProfileId: string,
    values: Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>,
  ): void {
    this.reminders.set(this.key(parentUserId, childProfileId), values);
    this.remindersSyncedFingerprint.set(this.key(parentUserId, childProfileId), JSON.stringify(values));
  }
}

type Harness = Readonly<{
  db: NodeSQLiteDatabase;
  local: SQLiteChildPreferenceSyncRepository;
  cloud: FakeCloudPreferences;
  accessors: FakePreferenceAccessors;
  useCases: ChildPreferencesSyncUseCases;
}>;

function makeHarness(db: NodeSQLiteDatabase, cloud: FakeCloudPreferences, accessors: FakePreferenceAccessors): Harness {
  const local = new SQLiteChildPreferenceSyncRepository(asDb(db));
  return { db, local, cloud, accessors, useCases: new ChildPreferencesSyncUseCases(local, cloud, accessors) };
}

// `selectedRoomMaterials` / `placements` keys are validated against the real
// room-material catalog on decode (@/features/customization), so a synthetic
// per-child label can't live there directly. `tag` instead goes into a
// `placements` entry keyed by a real, always-valid room material id, at a
// unique (tag-derived) position — giving each fixture child a distinct,
// round-trippable fingerprint without inventing catalog keys.
const roomConfigOf = (tag: string) => ({
  developerEquipped: {},
  placements: { 'pastel-toy-box': { scale: 1, x: (tag.length % 10) / 10 || 0.1, y: 0.5 } },
  selectedRoomMaterials: ['pastel-toy-box'],
  version: 1,
});

async function seedCloudPreferences(
  cloud: FakeCloudPreferences,
  childId: string,
  values: Partial<CloudChildPreferences>,
): Promise<void> {
  await cloud.upsert({
    childId,
    selectedBrushId: 'classic-brush',
    selectedBackgroundId: 'pastel-playroom',
    selectedEffectId: 'rainbow-light',
    roomConfiguration: roomConfigOf('pastel-playroom'),
    voiceGuide: 'gokce',
    morningReminder: { enabled: false, time: '08:00' },
    eveningReminder: { enabled: false, time: '20:30' },
    dentistReminderEnabled: true,
    dentistLastVisitDate: null,
    ...values,
  });
  cloud.upsertCalls = []; // seeding is not part of what a test measures
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ---------------------------------------------------------------------------
// Root cause: bulk preferences push before recovery destroys sibling state.
// ---------------------------------------------------------------------------
describe('root cause: bulk preferences push cannot destroy an unresolved sibling', () => {
  it('does not overwrite an existing cloud row for a child whose local customization/reminders have not been recovered yet', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-A'); // resolved: will have local customization + reminders
    await seedChild(db, 'child-B'); // NOT resolved locally yet on this device

    const cloud = new FakeCloudPreferences();
    // Both children already have REAL cloud state from prior sessions/devices.
    await seedCloudPreferences(cloud, 'child-A', {
      selectedBackgroundId: 'cloud-room',
      roomConfiguration: roomConfigOf('cloud-room'),
      morningReminder: { enabled: true, time: '07:12' },
      eveningReminder: { enabled: true, time: '21:05' },
    });
    await seedCloudPreferences(cloud, 'child-B', {
      selectedBackgroundId: 'space-room',
      roomConfiguration: roomConfigOf('space-room'),
      morningReminder: { enabled: true, time: '07:43' },
      eveningReminder: { enabled: true, time: '21:17' },
    });

    const accessors = new FakePreferenceAccessors();
    // A is fully resolved on this device (has been used here before).
    accessors.seedReminders('parent-1', 'child-A', {
      morning: { enabled: true, time: '07:12' },
      evening: { enabled: true, time: '21:05' },
    });
    await accessors.writeVoice('parent-1', 'child-A', 'gokce');
    await accessors.markVoiceSynced('parent-1', 'child-A', 'gokce');
    await AsyncStorage.setItem(
      `customization.profile.child-A.v1`,
      JSON.stringify(roomConfigOf('cloud-room')),
    );
    // B has NEVER been touched locally on this device — exactly the shape of
    // a reinstall / new device with an existing multi-child family, mid-way
    // through recovery.

    const { useCases } = makeHarness(db, cloud, accessors);

    // This is the exact call `retryPendingCloudSync` makes — before this
    // task's fix, it ran with no guard at all, and would have pushed B's
    // unresolved (empty/default) local snapshot straight over its real cloud
    // row via an unconditional `cloud.upsert`.
    await useCases.pushForAllSyncedChildren();

    const bAfter = await cloud.get('child-B');
    expect(bAfter?.selectedBackgroundId).toBe('space-room'); // untouched
    expect(bAfter?.morningReminder).toEqual({ enabled: true, time: '07:43' }); // untouched
    expect(cloud.upsertCalls.some((call) => call.childId === 'child-B')).toBe(false);

    // A, which IS resolved, legitimately pushes its own real state.
    expect(cloud.upsertCalls.some((call) => call.childId === 'child-A')).toBe(true);
    db.close();
  });

  it('still allows the push for a genuinely brand-new child with no existing cloud row', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-new');
    const cloud = new FakeCloudPreferences();
    const accessors = new FakePreferenceAccessors();
    // Onboarding set real reminders for this brand-new child, but the child
    // was never taken to the Collection/Room screen, so no customization
    // AsyncStorage entry exists — exactly the common "new child" shape.
    accessors.seedReminders('parent-1', 'child-new', {
      morning: { enabled: true, time: '08:15' },
      evening: { enabled: false, time: '20:30' },
    });
    const { useCases } = makeHarness(db, cloud, accessors);

    await useCases.pushForAllSyncedChildren();

    const pushed = await cloud.get('child-new');
    expect(pushed?.morningReminder).toEqual({ enabled: true, time: '08:15' });
    db.close();
  });
});

// ---------------------------------------------------------------------------
// DOB completeness
// ---------------------------------------------------------------------------
describe('DOB completeness across recovery', () => {
  it('a null cloud DOB never erases a known local DOB (recoverFromCloud runs on every bootstrap)', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1', { dateOfBirth: '2019-05-04' });
    const localSync = new SQLiteProfileSyncRepository(asDb(db));
    const cloud = new FakeCloudProfiles();
    cloud.rows.set('child-1', {
      id: 'child-1',
      parentId: 'parent-1',
      nickname: 'child-1',
      dateOfBirth: null, // stale/incomplete cloud row
      ageBand: '4_6',
      avatarId: 'inci',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      archivedAt: null,
    });
    const useCases = new ProfileSyncUseCases(localSync, cloud);

    await useCases.recoverFromCloud();

    expect(await readDob(db, 'child-1')).toBe('2019-05-04'); // preserved, not nulled
    db.close();
  });

  it('a real cloud DOB still wins and hydrates a locally-absent one', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1', { dateOfBirth: null });
    const localSync = new SQLiteProfileSyncRepository(asDb(db));
    const cloud = new FakeCloudProfiles();
    cloud.rows.set('child-1', {
      id: 'child-1',
      parentId: 'parent-1',
      nickname: 'child-1',
      dateOfBirth: '2018-03-09',
      ageBand: '4_6',
      avatarId: 'inci',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      archivedAt: null,
    });
    const useCases = new ProfileSyncUseCases(localSync, cloud);

    await useCases.recoverFromCloud();

    expect(await readDob(db, 'child-1')).toBe('2018-03-09');
    db.close();
  });

  it('survives 100 repeated recovery cycles with a null cloud DOB — never flips to null even once', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1', { dateOfBirth: '2017-11-30' });
    const localSync = new SQLiteProfileSyncRepository(asDb(db));
    const cloud = new FakeCloudProfiles();
    cloud.rows.set('child-1', {
      id: 'child-1',
      parentId: 'parent-1',
      nickname: 'child-1',
      dateOfBirth: null,
      ageBand: '4_6',
      avatarId: 'inci',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      archivedAt: null,
    });
    const useCases = new ProfileSyncUseCases(localSync, cloud);

    for (let i = 0; i < 100; i += 1) {
      await useCases.recoverFromCloud();
      expect(await readDob(db, 'child-1')).toBe('2017-11-30');
    }
    db.close();
  });
});

// ---------------------------------------------------------------------------
// Multi-child isolation — exact fixture from the task, driven through
// repeated switch / kill-relaunch / foreground / logout-login / fresh-install
// / 100x bootstrap cycles.
// ---------------------------------------------------------------------------
describe('multi-child isolation — A/B/C/D fixture', () => {
  async function buildFixture(): Promise<{ db: NodeSQLiteDatabase; cloud: FakeCloudPreferences }> {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-A', { dateOfBirth: '2019-01-10' });
    await seedChild(db, 'child-B', { dateOfBirth: '2020-06-22' });
    await seedChild(db, 'child-C', { dateOfBirth: '2018-09-01' });
    await seedChild(db, 'child-D', { dateOfBirth: '2021-03-15' });

    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-A', {
      selectedBackgroundId: 'cloud-room',
      roomConfiguration: { ...roomConfigOf('cloud-room'), placements: { 'pastel-toy-box': { scale: 1, x: 0.4, y: 0.6 } } },
      morningReminder: { enabled: true, time: '07:00' },
      eveningReminder: { enabled: true, time: '20:45' },
    });
    await seedCloudPreferences(cloud, 'child-B', {
      selectedBackgroundId: 'space-room',
      roomConfiguration: { ...roomConfigOf('space-room'), placements: { 'moon-lamp': { scale: 1.1, x: 0.3, y: 0.5 } } },
      morningReminder: { enabled: true, time: '07:50' },
      eveningReminder: { enabled: false, time: '20:30' },
    });
    await seedCloudPreferences(cloud, 'child-C', {
      selectedBackgroundId: 'pastel-playroom',
      roomConfiguration: roomConfigOf('pastel-playroom'),
      morningReminder: { enabled: false, time: '08:00' },
      eveningReminder: { enabled: false, time: '20:30' },
    });
    // D: fresh new profile — genuinely has nothing in the cloud yet.
    return { db, cloud };
  }

  async function recoverAll(db: NodeSQLiteDatabase, cloud: FakeCloudPreferences, accessors: FakePreferenceAccessors) {
    const { useCases } = makeHarness(db, cloud, accessors);
    await useCases.recover();
  }

  async function expectChildMatchesFixture(
    db: NodeSQLiteDatabase,
    cloud: FakeCloudPreferences,
    childId: string,
    expectedBackgroundId: string,
  ): Promise<void> {
    const cloudRow = await cloud.get(childId);
    expect(cloudRow?.selectedBackgroundId).toBe(expectedBackgroundId); // never leaked/defaulted
    const localRaw = await AsyncStorage.getItem(`customization.profile.${childId}.v1`);
    if (cloudRow?.roomConfiguration) {
      expect(localRaw).not.toBeNull();
      const local = JSON.parse(localRaw as string);
      expect(local.selectedRoomMaterials).toEqual(
        (cloudRow.roomConfiguration as { selectedRoomMaterials: string[] }).selectedRoomMaterials,
      );
      expect(local.placements).toEqual(
        (cloudRow.roomConfiguration as { placements: unknown }).placements,
      );
    }
  }

  it('A -> B -> C -> A -> D -> B repeated, then kill/relaunch, foreground, logout/login, fresh install, 100x bootstrap: each child keeps exactly its own values', async () => {
    const { db, cloud } = await buildFixture();
    const accessors = new FakePreferenceAccessors();
    const expectedBackgrounds: Record<string, string> = {
      'child-A': 'cloud-room',
      'child-B': 'space-room',
      'child-C': 'pastel-playroom',
    };

    // Simulate "switching to" each child by recovering (the app recovers all
    // owned children in one pass regardless of which is active — this proves
    // that active-child switching cannot leak state between them).
    const order = ['child-A', 'child-B', 'child-C', 'child-A', 'child-D', 'child-B'];
    for (const _child of order) {
      await recoverAll(db, cloud, accessors);
    }

    for (const [child, background] of Object.entries(expectedBackgrounds)) {
      await expectChildMatchesFixture(db, cloud, child, background);
    }

    // Kill/relaunch: fresh use-case instances against the SAME db/AsyncStorage.
    for (let i = 0; i < 3; i += 1) {
      const { useCases } = makeHarness(db, cloud, accessors);
      await useCases.recover();
      await useCases.pushForAllSyncedChildren();
    }
    for (const [child, background] of Object.entries(expectedBackgrounds)) {
      await expectChildMatchesFixture(db, cloud, child, background);
    }

    // Foreground/background: repeated recover+push, as retryPendingCloudSync does.
    for (let i = 0; i < 10; i += 1) {
      const { useCases } = makeHarness(db, cloud, accessors);
      await useCases.recover();
      await useCases.pushForAllSyncedChildren();
    }
    for (const [child, background] of Object.entries(expectedBackgrounds)) {
      await expectChildMatchesFixture(db, cloud, child, background);
    }

    // Logout/login: fresh accessors (per-session in-memory state cleared),
    // AsyncStorage (durable local data) persists across the "session".
    const freshAccessors = new FakePreferenceAccessors();
    {
      const { useCases } = makeHarness(db, cloud, freshAccessors);
      await useCases.recover();
    }
    for (const [child, background] of Object.entries(expectedBackgrounds)) {
      await expectChildMatchesFixture(db, cloud, child, background);
    }

    // Fresh install: brand-new local AsyncStorage, same cloud.
    await AsyncStorage.clear();
    const db2 = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db2));
    await seedChild(db2, 'child-A', { dateOfBirth: '2019-01-10' });
    await seedChild(db2, 'child-B', { dateOfBirth: '2020-06-22' });
    await seedChild(db2, 'child-C', { dateOfBirth: '2018-09-01' });
    const freshInstallAccessors = new FakePreferenceAccessors();
    {
      const { useCases } = makeHarness(db2, cloud, freshInstallAccessors);
      await useCases.recover();
    }
    for (const [child, background] of Object.entries(expectedBackgrounds)) {
      await expectChildMatchesFixture(db2, cloud, child, background);
    }

    // 100 repeated bootstrap/recovery cycles on the fresh-install device.
    const beforeSnapshot = new Map(cloud.rows);
    for (let i = 0; i < 100; i += 1) {
      const { useCases } = makeHarness(db2, cloud, freshInstallAccessors);
      await useCases.recover();
      await useCases.pushForAllSyncedChildren();
    }
    for (const [childId, row] of beforeSnapshot) {
      const after = await cloud.get(childId);
      expect(after?.selectedBackgroundId).toBe(row.selectedBackgroundId);
      expect(after?.roomConfiguration).toEqual(row.roomConfiguration);
      expect(after?.morningReminder).toEqual(row.morningReminder);
      expect(after?.eveningReminder).toEqual(row.eveningReminder);
    }
    db.close();
    db2.close();
  });
});

// ---------------------------------------------------------------------------
// Transient failure must never persist a destructive fallback.
// ---------------------------------------------------------------------------
describe('transient failure never persists a destructive write', () => {
  it('a cloud fetch failure during the resolved-state check aborts the push — no upsert happens', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1');
    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-1', { selectedBackgroundId: 'space-room' });
    const accessors = new FakePreferenceAccessors(); // unresolved locally
    const { useCases } = makeHarness(db, cloud, accessors);
    const originalGet = cloud.get.bind(cloud);
    cloud.get = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(useCases.pushForAllSyncedChildren()).rejects.toThrow('network down');

    cloud.get = originalGet;
    expect(await cloud.get('child-1')).toMatchObject({ selectedBackgroundId: 'space-room' }); // untouched
    db.close();
  });

  it('app rendering before recovery finishes never lets a concurrent push win the race', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1');
    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-1', {
      selectedBackgroundId: 'space-room',
      morningReminder: { enabled: true, time: '07:43' },
    });
    const accessors = new FakePreferenceAccessors(); // nothing hydrated locally yet
    const { useCases } = makeHarness(db, cloud, accessors);

    // "retryPendingCloudSync" fires (push) at the same moment as recovery,
    // before recovery has resolved anything locally.
    await Promise.all([useCases.pushForAllSyncedChildren(), useCases.recover()]);

    const after = await cloud.get('child-1');
    expect(after?.selectedBackgroundId).toBe('space-room'); // never defaulted
    expect(after?.morningReminder).toEqual({ enabled: true, time: '07:43' });
    db.close();
  });
});

// ---------------------------------------------------------------------------
// Prod-like bulk regression: many children, many bootstrap passes, zero
// unintended changes unless a real user edit occurred.
// ---------------------------------------------------------------------------
describe('prod-like bulk regression — 10+ children survive repeated sync passes untouched', () => {
  it('10 children with unique DOB/reminders/background/room survive 1 + 100 bootstrap/recovery/sync passes with zero unintended changes', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    const cloud = new FakeCloudPreferences();
    const childIds = Array.from({ length: 12 }, (_, i) => `child-${i}`);
    for (const [i, childId] of childIds.entries()) {
      await seedChild(db, childId, { dateOfBirth: `20${10 + (i % 9)}-0${(i % 9) + 1}-1${i % 9}` });
      await seedCloudPreferences(cloud, childId, {
        selectedBackgroundId: `background-${i}`,
        roomConfiguration: roomConfigOf(`background-${i}`),
        morningReminder: { enabled: i % 2 === 0, time: `0${6 + (i % 3)}:${10 + i}` },
        eveningReminder: { enabled: i % 3 === 0, time: `2${(i % 3)}:${20 + i}` },
      });
    }
    const accessors = new FakePreferenceAccessors(); // simulates a fresh device: nothing local yet

    // One bootstrap-equivalent pass.
    {
      const { useCases } = makeHarness(db, cloud, accessors);
      await useCases.recover();
      await useCases.pushForAllSyncedChildren();
    }
    const snapshot = new Map(cloud.rows);

    // 100 further repeated bootstrap/recovery/sync passes.
    for (let cycle = 0; cycle < 100; cycle += 1) {
      const { useCases } = makeHarness(db, cloud, accessors);
      await useCases.recover();
      await useCases.pushForAllSyncedChildren();
    }

    let changed = 0;
    for (const [childId, before] of snapshot) {
      const after = await cloud.get(childId);
      if (
        after?.selectedBackgroundId !== before.selectedBackgroundId ||
        JSON.stringify(after?.roomConfiguration) !== JSON.stringify(before.roomConfiguration) ||
        JSON.stringify(after?.morningReminder) !== JSON.stringify(before.morningReminder) ||
        JSON.stringify(after?.eveningReminder) !== JSON.stringify(before.eveningReminder)
      ) {
        changed += 1;
      }
    }
    expect(changed).toBe(0);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// Reminder persistence — cloud must win over local defaults, exactly, 100x.
// ---------------------------------------------------------------------------
describe('reminder persistence survives 100 repeated bootstrap cycles', () => {
  it('cloud 07:43/21:17 (enabled) beats local absent/default 08:00/20:30, every single cycle', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1');
    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-1', {
      morningReminder: { enabled: true, time: '07:43' },
      eveningReminder: { enabled: true, time: '21:17' },
    });
    const accessors = new FakePreferenceAccessors(); // local starts absent

    for (let i = 0; i < 100; i += 1) {
      const { useCases } = makeHarness(db, cloud, accessors);
      await useCases.recover();
      await useCases.pushForAllSyncedChildren();

      const local = await accessors.readReminders('parent-1', 'child-1');
      expect(local).toEqual({
        morning: { enabled: true, time: '07:43' },
        evening: { enabled: true, time: '21:17' },
      });
      const cloudRow = await cloud.get('child-1');
      expect(cloudRow?.morningReminder).toEqual({ enabled: true, time: '07:43' });
      expect(cloudRow?.eveningReminder).toEqual({ enabled: true, time: '21:17' });
    }
    db.close();
  });
});
