import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  ChildPreferencesSyncUseCases,
  type ChildPreferenceAccessors,
} from '@/application/sync/ChildPreferencesSyncUseCases';
import { ProfileSyncUseCases } from '@/application/sync/ProfileSyncUseCases';
import { migrateDatabase } from '@/data/db';
import type {
  ChildReminderPatch,
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

const BLANK_CLOUD_ROW: Omit<CloudChildPreferences, 'childId'> = {
  selectedBrushId: null,
  selectedBackgroundId: null,
  selectedEffectId: null,
  roomConfiguration: null,
  voiceGuide: null,
  morningReminder: { enabled: false, time: null },
  eveningReminder: { enabled: false, time: null },
  dentistReminderEnabled: false,
  dentistLastVisitDate: null,
  dentistNextAppointmentDate: null,
  nicknamePersonalizationEnabled: null,
};

/** In-memory stand-in for the Supabase `child_preferences` table. */
class FakeCloudPreferences implements CloudChildPreferencesRepository {
  readonly rows = new Map<string, CloudChildPreferences>();
  upsertCalls: CloudChildPreferences[] = [];
  /** Every field-scoped reminder patch the client sent, in order. */
  reminderPatchCalls: { childId: string; patch: ChildReminderPatch }[] = [];

  async upsert(
    preferences: CloudChildPreferences,
    opts?: Readonly<{ includeCustomization?: boolean }>,
  ): Promise<void> {
    this.upsertCalls.push(preferences);
    const existing = this.rows.get(preferences.childId);
    // Mirror the real repo:
    //  - reminder columns are NEVER carried by the whole-row upsert (kept from
    //    the existing row / unset on a new one).
    //  - customization columns are carried ONLY when includeCustomization is
    //    true; otherwise the existing row's values are preserved.
    const includeCustomization = opts?.includeCustomization ?? true;
    this.rows.set(preferences.childId, {
      ...preferences,
      selectedBrushId: includeCustomization
        ? preferences.selectedBrushId
        : (existing?.selectedBrushId ?? null),
      selectedBackgroundId: includeCustomization
        ? preferences.selectedBackgroundId
        : (existing?.selectedBackgroundId ?? null),
      selectedEffectId: includeCustomization
        ? preferences.selectedEffectId
        : (existing?.selectedEffectId ?? null),
      roomConfiguration: includeCustomization
        ? preferences.roomConfiguration
        : (existing?.roomConfiguration ?? null),
      morningReminder: existing?.morningReminder ?? { enabled: false, time: null },
      eveningReminder: existing?.eveningReminder ?? { enabled: false, time: null },
      updatedAt: new Date().toISOString(),
    });
  }

  async patchReminders(childId: string, patch: ChildReminderPatch): Promise<void> {
    this.reminderPatchCalls.push({ childId, patch });
    const row = this.rows.get(childId) ?? { childId, ...BLANK_CLOUD_ROW };
    const morning = { ...row.morningReminder };
    const evening = { ...row.eveningReminder };
    if ('morning_reminder_enabled' in patch) morning.enabled = patch.morning_reminder_enabled!;
    if ('morning_reminder_time' in patch) morning.time = patch.morning_reminder_time ?? null;
    if ('evening_reminder_enabled' in patch) evening.enabled = patch.evening_reminder_enabled!;
    if ('evening_reminder_time' in patch) evening.time = patch.evening_reminder_time ?? null;
    this.rows.set(childId, {
      ...row,
      morningReminder: morning,
      eveningReminder: evening,
      updatedAt: new Date().toISOString(),
    });
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
  readonly nicknamePersonalization = new Map<string, boolean>();
  private readonly nicknamePersonalizationSyncedValue = new Map<string, boolean>();

  /**
   * Real dentist recovery (`DentistVisitService.applyRecovered`) persists into
   * the SQLite `dentist_reminders` table that the harness's REAL
   * `SQLiteChildPreferenceSyncRepository` also reads (`dentistReminderEnabled`
   * / `readDentistDatesForPush`). This fake mirrors that by writing to the
   * SAME database the harness was built against, so "recovery makes this
   * device resolved" holds exactly as it does in production.
   */
  constructor(private readonly db?: NodeSQLiteDatabase) {}

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

  /** Advancing "last successful reminder sync" clock, mirrors markSynced()'s toISOString(). */
  private remindersSyncedAt = new Map<string, string>();

  async markRemindersSynced(parentUserId: string, childProfileId: string): Promise<void> {
    const current = await this.readReminders(parentUserId, childProfileId);
    const k = this.key(parentUserId, childProfileId);
    this.remindersSyncedFingerprint.set(k, JSON.stringify(current));
    this.remindersSyncedAt.set(k, new Date().toISOString());
  }

  async readRemindersSyncMeta(
    parentUserId: string,
    childProfileId: string,
  ): Promise<Readonly<{ syncedAt: string | null; dirty: boolean }>> {
    const k = this.key(parentUserId, childProfileId);
    if (!this.reminders.has(k)) return { syncedAt: null, dirty: false };
    const synced = this.remindersSyncedFingerprint.get(k);
    const current = JSON.stringify(this.reminders.get(k));
    return {
      syncedAt: synced ? (this.remindersSyncedAt.get(k) ?? null) : null,
      dirty: synced !== current,
    };
  }

  /** Directly seed reminders as "the cloud already knows this" for a fixture. */
  seedReminders(
    parentUserId: string,
    childProfileId: string,
    values: Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>,
    syncedAt = '2026-01-01T00:00:00.000Z',
  ): void {
    const k = this.key(parentUserId, childProfileId);
    this.reminders.set(k, values);
    this.remindersSyncedFingerprint.set(k, JSON.stringify(values));
    this.remindersSyncedAt.set(k, syncedAt);
  }

  /** Seed a record with NO recorded sync (seed-on-read / legacy / old code). */
  seedRemindersWithoutSyncMark(
    parentUserId: string,
    childProfileId: string,
    values: Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>,
  ): void {
    this.reminders.set(this.key(parentUserId, childProfileId), values);
  }

  async applyRecoveredDentist(
    childProfileId: string,
    _nickname: string,
    values: Readonly<{ lastVisitDate: string | null; nextAppointmentDate: string | null }>,
  ): Promise<void> {
    if (!this.db) return;
    const now = '2026-08-01T00:00:00.000Z';
    await this.db.runAsync(
      `INSERT INTO dentist_reminders
        (child_profile_id, first_due_at, second_due_at, last_visit_date, next_appointment_date,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(child_profile_id) DO UPDATE SET
        last_visit_date = excluded.last_visit_date,
        next_appointment_date = excluded.next_appointment_date`,
      childProfileId,
      now,
      now,
      values.lastVisitDate,
      values.nextAppointmentDate,
      now,
      now,
    );
  }

  async readNicknamePersonalization(parentUserId: string, childProfileId: string): Promise<boolean> {
    return this.nicknamePersonalization.get(this.key(parentUserId, childProfileId)) ?? false;
  }

  async hasStoredNicknamePersonalization(
    parentUserId: string,
    childProfileId: string,
  ): Promise<boolean> {
    return this.nicknamePersonalization.has(this.key(parentUserId, childProfileId));
  }

  async writeNicknamePersonalization(
    parentUserId: string,
    childProfileId: string,
    enabled: boolean,
  ): Promise<void> {
    this.nicknamePersonalization.set(this.key(parentUserId, childProfileId), enabled);
  }

  async markNicknamePersonalizationSynced(
    parentUserId: string,
    childProfileId: string,
    enabled: boolean,
  ): Promise<void> {
    this.nicknamePersonalizationSyncedValue.set(this.key(parentUserId, childProfileId), enabled);
  }

  async readNicknamePersonalizationSyncMeta(
    parentUserId: string,
    childProfileId: string,
  ): Promise<Readonly<{ syncedAt: string | null; dirty: boolean }>> {
    const k = this.key(parentUserId, childProfileId);
    if (!this.nicknamePersonalization.has(k)) return { syncedAt: null, dirty: false };
    const synced = this.nicknamePersonalizationSyncedValue.get(k);
    return {
      syncedAt: synced !== undefined ? '2026-01-01T00:00:00.000Z' : null,
      dirty: synced !== this.nicknamePersonalization.get(k),
    };
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
  // Written straight onto the row: this fixture represents cloud state a
  // device accumulated across earlier sessions — customization/voice/dentist
  // via the whole-row upsert AND reminder columns via prior real
  // `patch_child_preferences` (reminder-key-only) edits. The real `upsert()`
  // never sends reminder columns, so seeding reminders through it would
  // silently drop them.
  cloud.rows.set(childId, {
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
    dentistNextAppointmentDate: null,
    nicknamePersonalizationEnabled: null,
    updatedAt: new Date().toISOString(),
    ...values,
  });
  cloud.upsertCalls = []; // seeding is not part of what a test measures
  cloud.reminderPatchCalls = [];
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

    const accessors = new FakePreferenceAccessors(db);
    // A is fully resolved on this device (has been used here before) —
    // including its dentist state, seeded directly the same way the other
    // three "already resolved" signals are, since recover() is not called in
    // this test (pushForAllSyncedChildren is called directly, matching the
    // real retryPendingCloudSync call this test documents).
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
    await db.runAsync(
      `INSERT INTO dentist_reminders
        (child_profile_id, first_due_at, second_due_at, created_at, updated_at)
       VALUES ('child-A', '2027-02-01T00:00:00.000Z', '2027-08-01T00:00:00.000Z',
         '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
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

  it('still allows the whole-row push for a genuinely brand-new child, and reminders land via the field-scoped patch (onboarding path)', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-new');
    const cloud = new FakeCloudPreferences();
    const accessors = new FakePreferenceAccessors(db);
    // Onboarding set real reminders for this brand-new child, but the child
    // was never taken to the Collection/Room screen, so no customization
    // AsyncStorage entry exists — exactly the common "new child" shape.
    accessors.seedReminders('parent-1', 'child-new', {
      morning: { enabled: true, time: '08:15' },
      evening: { enabled: false, time: '20:30' },
    });
    const { useCases } = makeHarness(db, cloud, accessors);

    // Whole-row push establishes the row (customization/voice/dentist) but
    // NEVER carries reminder columns — the client has no write grant for them.
    await useCases.pushForAllSyncedChildren();
    const pushed = await cloud.get('child-new');
    expect(pushed).not.toBeNull();
    expect(pushed?.morningReminder).toEqual({ enabled: false, time: null });
    expect(cloud.reminderPatchCalls).toHaveLength(0);

    // Onboarding's own explicit reminder patch (services.ts `syncChildReminders`
    // -> `pushReminderEdit`) is what lands the chosen times.
    await useCases.pushReminderEdit('child-new', {
      morning_reminder_enabled: true,
      morning_reminder_time: '08:15',
      evening_reminder_enabled: false,
      evening_reminder_time: '20:30',
    });
    const afterPatch = await cloud.get('child-new');
    expect(afterPatch?.morningReminder).toEqual({ enabled: true, time: '08:15' });
    expect(afterPatch?.eveningReminder).toEqual({ enabled: false, time: '20:30' });
    db.close();
  });
});

// ---------------------------------------------------------------------------
// DOB completeness
// ---------------------------------------------------------------------------
describe('DOB completeness across recovery', () => {
  it('a null cloud DOB clears a STALE local DOB (product no longer collects/writes birth dates)', async () => {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    // Simulates an older device that collected a real birth date before the
    // product stopped doing so.
    await seedChild(db, 'child-1', { dateOfBirth: '2019-05-04' });
    const localSync = new SQLiteProfileSyncRepository(asDb(db));
    const cloud = new FakeCloudProfiles();
    cloud.rows.set('child-1', {
      id: 'child-1',
      parentId: 'parent-1',
      nickname: 'child-1',
      dateOfBirth: null, // the cloud never writes this column anymore
      ageBand: '4_6',
      avatarId: 'inci',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      archivedAt: null,
    });
    const useCases = new ProfileSyncUseCases(localSync, cloud);

    await useCases.recoverFromCloud();

    expect(await readDob(db, 'child-1')).toBeNull(); // cloud NULL wins, stale local value cleared
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

  it('stays NULL across 100 repeated recovery cycles with a null cloud DOB — never flips back to a stale value', async () => {
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
      expect(await readDob(db, 'child-1')).toBeNull();
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
    const accessors = new FakePreferenceAccessors(db);
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
    const freshAccessors = new FakePreferenceAccessors(db);
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
    const freshInstallAccessors = new FakePreferenceAccessors(db2);
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
    const accessors = new FakePreferenceAccessors(db); // unresolved locally
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
    const accessors = new FakePreferenceAccessors(db); // nothing hydrated locally yet
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
    const accessors = new FakePreferenceAccessors(db); // simulates a fresh device: nothing local yet

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
    const accessors = new FakePreferenceAccessors(db); // local starts absent

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

// ---------------------------------------------------------------------------
// The reported bug, end to end: Device A changes a reminder time; Device B —
// which never held that custom time — must NEVER push it back to the default
// on any number of foreground sync cycles.
// ---------------------------------------------------------------------------
describe('cross-device: a stale device never reverts another device’s reminder edit', () => {
  /** One physical device: its own SQLite db + its own per-parent reminder store. */
  async function makeDevice(cloud: FakeCloudPreferences): Promise<Harness> {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1');
    return makeHarness(db, cloud, new FakePreferenceAccessors(db));
  }

  it('Device B holding the 08:00 / 20:30 default does not clobber Device A’s 07:15 across 50 foreground cycles', async () => {
    const cloud = new FakeCloudPreferences();
    // The child's cloud row already exists (created at onboarding, reminders
    // still unset — the common shape).
    cloud.rows.set('child-1', {
      childId: 'child-1',
      selectedBrushId: 'classic-brush',
      selectedBackgroundId: 'pastel-playroom',
      selectedEffectId: null,
      roomConfiguration: roomConfigOf('pastel-playroom'),
      voiceGuide: 'gokce',
      morningReminder: { enabled: false, time: null },
      eveningReminder: { enabled: false, time: null },
      dentistReminderEnabled: true,
      dentistLastVisitDate: null,
      dentistNextAppointmentDate: null,
      nicknamePersonalizationEnabled: null,
      updatedAt: new Date().toISOString(),
    });

    const deviceA = await makeDevice(cloud);
    const deviceB = await makeDevice(cloud);

    // Device B has a stale per-child reminder record: the pre-per-child legacy
    // seed / recovery placeholder — exactly the 08:00 / 20:30 default that used
    // to get pushed back over a real edit.
    deviceB.accessors.seedReminders('parent-1', 'child-1', {
      morning: { enabled: false, time: '08:00' },
      evening: { enabled: false, time: '20:30' },
    });

    // Device A: the parent opens the reminder screen and sets morning 07:15.
    // (ReminderSettingsService.update writes the local record; the screen then
    // calls syncChildReminders -> pushReminderEdit with the exact chosen value.)
    deviceA.accessors.seedReminders('parent-1', 'child-1', {
      morning: { enabled: true, time: '07:15' },
      evening: { enabled: false, time: '20:30' },
    });
    await deviceA.useCases.pushReminderEdit('child-1', {
      morning_reminder_enabled: true,
      morning_reminder_time: '07:15',
    });

    expect((await cloud.get('child-1'))?.morningReminder).toEqual({ enabled: true, time: '07:15' });
    cloud.reminderPatchCalls = []; // only Device B's activity matters from here

    // Device B foregrounds 50 times: each cycle recovers, then runs the exact
    // push retryPendingCloudSync makes. It must never touch the reminder cols.
    for (let cycle = 0; cycle < 50; cycle += 1) {
      const b = makeHarness(deviceB.db, cloud, deviceB.accessors);
      await b.useCases.recover();
      await b.useCases.pushForAllSyncedChildren();

      const cloudRow = await cloud.get('child-1');
      expect(cloudRow?.morningReminder).toEqual({ enabled: true, time: '07:15' });
    }

    // The whole-row push from B never carried a reminder value.
    expect(cloud.reminderPatchCalls).toHaveLength(0);
    // Device A's own local record is untouched.
    expect(await deviceA.accessors.readReminders('parent-1', 'child-1')).toEqual({
      morning: { enabled: true, time: '07:15' },
      evening: { enabled: false, time: '20:30' },
    });
    // ...and Device B has CONVERGED to the cloud value (its stale 08:00 is gone).
    expect(await deviceB.accessors.readReminders('parent-1', 'child-1')).toEqual({
      morning: { enabled: true, time: '07:15' },
      evening: { enabled: false, time: '20:30' },
    });

    deviceA.db.close();
    deviceB.db.close();
  });

  it('Device B with a CLEAN synced stale record (08:00/20:30) converges to the cloud 08:01/20:31 on recover, and stays converged across reopen / profile-switch, without ever writing the cloud', async () => {
    const cloud = new FakeCloudPreferences();
    // Device A edited both reminder slots; the cloud row carries the real
    // values with a fresh updated_at (a later edit than Device B ever synced).
    await seedCloudPreferences(cloud, 'child-1', {
      morningReminder: { enabled: true, time: '08:01' },
      eveningReminder: { enabled: true, time: '20:31' },
      updatedAt: '2026-09-09T09:48:06.000Z',
    });

    const deviceB = await makeDevice(cloud);
    // B holds a real, previously-synced record — NOT dirty — but stale: it was
    // last synced on 2026-09-01, before Device A's 2026-09-09 edit.
    deviceB.accessors.seedReminders(
      'parent-1',
      'child-1',
      { morning: { enabled: false, time: '08:00' }, evening: { enabled: false, time: '20:30' } },
      '2026-09-01T00:00:00.000Z',
    );

    // First open on B.
    {
      const b = makeHarness(deviceB.db, cloud, deviceB.accessors);
      await b.useCases.recover();
    }
    expect(await deviceB.accessors.readReminders('parent-1', 'child-1')).toEqual({
      morning: { enabled: true, time: '08:01' },
      evening: { enabled: true, time: '20:31' },
    });
    expect(cloud.reminderPatchCalls).toHaveLength(0);
    expect(cloud.upsertCalls).toHaveLength(0);
    const cloudAfterFirst = await cloud.get('child-1');

    // Reopen, profile-switch, foreground → each just calls recover() again.
    for (let i = 0; i < 10; i += 1) {
      const b = makeHarness(deviceB.db, cloud, deviceB.accessors);
      await b.useCases.recover();
    }
    expect(await deviceB.accessors.readReminders('parent-1', 'child-1')).toEqual({
      morning: { enabled: true, time: '08:01' },
      evening: { enabled: true, time: '20:31' },
    });
    // Cloud row is byte-for-byte unchanged by any amount of recovery.
    expect(await cloud.get('child-1')).toEqual(cloudAfterFirst);
    expect(cloud.reminderPatchCalls).toHaveLength(0);
    expect(cloud.upsertCalls).toHaveLength(0);

    deviceB.db.close();
  });

  it('Device B with a seed-on-read record (no recorded sync) also converges to the cloud value', async () => {
    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-1', {
      morningReminder: { enabled: true, time: '08:01' },
      eveningReminder: { enabled: true, time: '20:31' },
      updatedAt: '2026-09-09T09:48:06.000Z',
    });
    const deviceB = await makeDevice(cloud);
    // A record exists (seeded by ReminderSettingsService.get() reading the
    // legacy key) but markSynced was never called → syncedAt is null.
    deviceB.accessors.seedRemindersWithoutSyncMark('parent-1', 'child-1', {
      morning: { enabled: false, time: '08:00' },
      evening: { enabled: false, time: '20:30' },
    });

    const b = makeHarness(deviceB.db, cloud, deviceB.accessors);
    await b.useCases.recover();

    expect(await deviceB.accessors.readReminders('parent-1', 'child-1')).toEqual({
      morning: { enabled: true, time: '08:01' },
      evening: { enabled: true, time: '20:31' },
    });
    expect(cloud.reminderPatchCalls).toHaveLength(0);
    deviceB.db.close();
  });

  it('cloud-authoritative: a local reminder value that differs from the cloud converges to the cloud on recover, regardless of local sync markers/timestamps', async () => {
    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-1', {
      morningReminder: { enabled: true, time: '08:00' },
      eveningReminder: { enabled: true, time: '20:30' },
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    const deviceB = await makeDevice(cloud);
    // Local holds a different value AND a very recent sync stamp — the old
    // `syncedAt`/`cloudRowNewerThan` gate would have kept the local value.
    deviceB.accessors.seedReminders(
      'parent-1',
      'child-1',
      { morning: { enabled: true, time: '07:05' }, evening: { enabled: true, time: '21:45' } },
      '2026-09-09T10:00:00.000Z',
    );

    const b = makeHarness(deviceB.db, cloud, deviceB.accessors);
    await b.useCases.recover();

    // Converged to the cloud value; recover() never wrote the cloud.
    expect(await deviceB.accessors.readReminders('parent-1', 'child-1')).toEqual({
      morning: { enabled: true, time: '08:00' },
      evening: { enabled: true, time: '20:30' },
    });
    expect(cloud.reminderPatchCalls).toHaveLength(0);
    expect(cloud.upsertCalls).toHaveLength(0);
    deviceB.db.close();
  });

  it('a fresh Device B (no local reminder record) hydrates 07:15 from the cloud and still never pushes a default back', async () => {
    const cloud = new FakeCloudPreferences();
    const deviceA = await makeDevice(cloud);
    const deviceB = await makeDevice(cloud);

    // Device A establishes the row + sets both reminder slots explicitly.
    await deviceA.useCases.pushForAllSyncedChildren(); // creates the row (no reminder cols)
    deviceA.accessors.seedReminders('parent-1', 'child-1', {
      morning: { enabled: true, time: '07:15' },
      evening: { enabled: true, time: '21:40' },
    });
    await deviceA.useCases.pushReminderEdit('child-1', {
      morning_reminder_enabled: true,
      morning_reminder_time: '07:15',
      evening_reminder_enabled: true,
      evening_reminder_time: '21:40',
    });
    cloud.reminderPatchCalls = []; // only Device B's activity matters from here

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const b = makeHarness(deviceB.db, cloud, deviceB.accessors);
      await b.useCases.recover();
      await b.useCases.pushForAllSyncedChildren();
    }

    // B hydrated the real times locally...
    expect(await deviceB.accessors.readReminders('parent-1', 'child-1')).toEqual({
      morning: { enabled: true, time: '07:15' },
      evening: { enabled: true, time: '21:40' },
    });
    // ...and the cloud is still exactly A's edit.
    const cloudRow = await cloud.get('child-1');
    expect(cloudRow?.morningReminder).toEqual({ enabled: true, time: '07:15' });
    expect(cloudRow?.eveningReminder).toEqual({ enabled: true, time: '21:40' });
    expect(cloud.reminderPatchCalls).toHaveLength(0); // B never patched

    deviceA.db.close();
    deviceB.db.close();
  });
});

// ---------------------------------------------------------------------------
// Collection selections (brush / background / room layout) must reach every
// device, and a stale device's foreground push must not clobber them.
// ---------------------------------------------------------------------------
describe('cross-device: Collection selections converge and are not clobbered', () => {
  const CUSTO_KEY = 'customization.profile.child-1.v1';

  const stateWith = (
    dev: Record<string, string>,
    placements: Record<string, { x: number; y: number; scale: number }>,
    materials: string[],
  ) => ({ version: 1, developerEquipped: dev, placements, selectedRoomMaterials: materials });

  async function makeDevice(cloud: FakeCloudPreferences): Promise<Harness> {
    const db = new NodeSQLiteDatabase();
    await migrateDatabase(asDb(db));
    await seedChild(db, 'child-1');
    return makeHarness(db, cloud, new FakePreferenceAccessors(db));
  }

  // The cloud row = "what another device already pushed": star-brush + a room
  // placement, plus resolved voice / reminders / dentist so recover() fully
  // resolves this device (isSafeToPush needs all of them).
  const otherDeviceState = stateWith(
    { brush: 'star-brush' },
    { 'pastel-toy-box': { x: 0.4, y: 0.7, scale: 0.9 } },
    ['pastel-toy-box'],
  );

  it('Device B converges to another device\'s brush + room layout on recover, and B\'s foreground pushes never clobber it', async () => {
    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-1', {
      selectedBrushId: 'star-brush',
      selectedBackgroundId: 'pastel-playroom',
      selectedEffectId: null,
      roomConfiguration: otherDeviceState,
      morningReminder: { enabled: true, time: '08:00' },
      eveningReminder: { enabled: true, time: '20:30' },
    });
    const deviceB = await makeDevice(cloud);

    // B holds a DIFFERENT local customization, already marked synced (clean).
    const bState = stateWith({ brush: 'classic-brush' }, {}, []);
    await AsyncStorage.setItem(CUSTO_KEY, JSON.stringify(bState));
    await deviceB.local.markCustomizationSynced('child-1', bState);
    expect(await deviceB.local.readCustomizationSyncMeta('child-1')).toMatchObject({ dirty: false });

    await deviceB.useCases.recover();

    // B converged to the cloud selection + room layout.
    const bAfter = JSON.parse((await AsyncStorage.getItem(CUSTO_KEY)) as string);
    expect(bAfter.developerEquipped.brush).toBe('star-brush');
    expect(bAfter.placements).toEqual(otherDeviceState.placements);
    expect(bAfter.selectedRoomMaterials).toEqual(['pastel-toy-box']);
    expect(await deviceB.local.readCustomizationSyncMeta('child-1')).toMatchObject({ dirty: false });

    // B foregrounds 20 times → recover + whole-row push. It is clean, so every
    // push omits the customization columns (includeCustomization:false) — the
    // cloud selection is never rewritten by B's older local state.
    cloud.upsertCalls = [];
    for (let i = 0; i < 20; i += 1) {
      const b = makeHarness(deviceB.db, cloud, deviceB.accessors);
      await b.useCases.recover();
      await b.useCases.pushForAllSyncedChildren();
    }
    expect(cloud.upsertCalls.length).toBeGreaterThan(0); // B's whole-row push DID run
    const cloudEnd = await cloud.get('child-1');
    expect(cloudEnd?.selectedBrushId).toBe('star-brush');
    expect(cloudEnd?.roomConfiguration).toEqual(otherDeviceState);

    deviceB.db.close();
  });

  it('a device with a PENDING local Collection edit keeps it through recover, then pushes it to the cloud', async () => {
    const cloud = new FakeCloudPreferences();
    await seedCloudPreferences(cloud, 'child-1', {
      selectedBrushId: 'star-brush',
      roomConfiguration: otherDeviceState,
      morningReminder: { enabled: true, time: '08:00' },
      eveningReminder: { enabled: true, time: '20:30' },
    });
    const deviceB = await makeDevice(cloud);

    // First recover resolves the child (voice/reminders/dentist) and converges
    // customization to the cloud's star-brush.
    await deviceB.useCases.recover();
    expect(
      JSON.parse((await AsyncStorage.getItem(CUSTO_KEY)) as string).developerEquipped.brush,
    ).toBe('star-brush');

    // Now B picks pink-brush locally and has NOT synced it yet (dirty).
    const bState = stateWith({ brush: 'pink-brush' }, {}, []);
    await AsyncStorage.setItem(CUSTO_KEY, JSON.stringify(bState));
    expect(await deviceB.local.readCustomizationSyncMeta('child-1')).toMatchObject({ dirty: true });

    // recover() must NOT overwrite B's pending edit.
    await deviceB.useCases.recover();
    expect(
      JSON.parse((await AsyncStorage.getItem(CUSTO_KEY)) as string).developerEquipped.brush,
    ).toBe('pink-brush');

    // B's push carries the customization (it is dirty) → cloud takes B's edit.
    await deviceB.useCases.pushForProfile('child-1');
    expect((await cloud.get('child-1'))?.selectedBrushId).toBe('pink-brush');

    deviceB.db.close();
  });
});
