import { ReminderSettingsService } from '@/features/reminders/reminderSettings';

import type {
  CloudChildPreferences,
  CloudChildPreferencesRepository,
  LocalChildPreferenceSyncRepository,
} from '@/domain/sync';

import {
  ChildPreferencesSyncUseCases,
  type ChildPreferenceAccessors,
} from '../ChildPreferencesSyncUseCases';

const roomConfig = {
  developerEquipped: { brush: 'star-brush', background: 'cloud-room', effect: 'gold-sparkle' },
  placements: { 'pastel-toy-box': { scale: 1, x: 0.4, y: 0.7 } },
  selectedRoomMaterials: ['pastel-toy-box'],
  version: 1,
};

const cloudRow: CloudChildPreferences = {
  childId: 'child-remote-1',
  selectedBrushId: 'star-brush',
  selectedBackgroundId: 'cloud-room',
  selectedEffectId: 'gold-sparkle',
  roomConfiguration: roomConfig,
  voiceGuide: 'samet',
  morningReminder: { enabled: true, time: '07:15' },
  eveningReminder: { enabled: true, time: '21:00' },
  dentistReminderEnabled: true,
  dentistLastVisitDate: null,
  dentistNextAppointmentDate: null,
  nicknamePersonalizationEnabled: null,
};

const local = (
  overrides: Partial<jest.Mocked<LocalChildPreferenceSyncRepository>> = {},
): jest.Mocked<LocalChildPreferenceSyncRepository> => ({
  resolveRemoteChildId: jest.fn().mockResolvedValue('child-remote-1'),
  listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-1']),
  resolveParentUserId: jest.fn().mockResolvedValue('parent-1'),
  readCustomizationForPush: jest.fn().mockResolvedValue({
    selectedBrushId: 'star-brush',
    selectedBackgroundId: 'cloud-room',
    selectedEffectId: 'gold-sparkle',
    roomConfiguration: roomConfig,
  }),
  dentistReminderEnabled: jest.fn().mockResolvedValue(true),
  readDentistDatesForPush: jest
    .fn()
    .mockResolvedValue({ lastVisitDate: null, nextAppointmentDate: null }),
  resolveNickname: jest.fn().mockResolvedValue('Ada'),
  hasLocalCustomization: jest.fn().mockResolvedValue(false),
  hydrateCustomization: jest.fn().mockResolvedValue(undefined),
  findProfileByRemoteChildId: jest.fn().mockResolvedValue('profile-1'),
  markCustomizationSynced: jest.fn().mockResolvedValue(undefined),
  readCustomizationSyncMeta: jest
    .fn()
    .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
  ...overrides,
});

const cloud = (
  rows: readonly CloudChildPreferences[] = [],
  overrides: Partial<jest.Mocked<CloudChildPreferencesRepository>> = {},
): jest.Mocked<CloudChildPreferencesRepository> => ({
  upsert: jest.fn().mockResolvedValue(undefined),
  patchReminders: jest.fn().mockResolvedValue(undefined),
  // Defaults to "no existing cloud row" so a not-fully-resolved local state
  // (the default shape below) still represents the safe, genuinely-new-child
  // case unless a test explicitly overrides it to simulate an EXISTING row.
  get: jest.fn().mockResolvedValue(null),
  listOwned: jest.fn().mockResolvedValue(rows),
  ...overrides,
});

const prefs = (
  overrides: Partial<jest.Mocked<ChildPreferenceAccessors>> = {},
): jest.Mocked<ChildPreferenceAccessors> => ({
  readVoice: jest.fn().mockResolvedValue('samet'),
  hasStoredVoice: jest.fn().mockResolvedValue(false),
  writeVoice: jest.fn().mockResolvedValue(undefined),
  markVoiceSynced: jest.fn().mockResolvedValue(undefined),
  readVoiceSyncMeta: jest
    .fn()
    .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
  readReminders: jest.fn().mockResolvedValue({
    morning: { enabled: true, time: '07:30' },
    evening: { enabled: false, time: '20:00' },
  }),
  hasStoredReminders: jest.fn().mockResolvedValue(false),
  applyRecoveredReminders: jest.fn().mockResolvedValue(undefined),
  markRemindersSynced: jest.fn().mockResolvedValue(undefined),
  readRemindersSyncMeta: jest
    .fn()
    .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
  applyRecoveredDentist: jest.fn().mockResolvedValue(undefined),
  readNicknamePersonalization: jest.fn().mockResolvedValue(false),
  hasStoredNicknamePersonalization: jest.fn().mockResolvedValue(true),
  writeNicknamePersonalization: jest.fn().mockResolvedValue(undefined),
  markNicknamePersonalizationSynced: jest.fn().mockResolvedValue(undefined),
  readNicknamePersonalizationSyncMeta: jest
    .fn()
    .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
  ...overrides,
});

describe('ChildPreferencesSyncUseCases', () => {
  it('pushes a full preference snapshot scoped to the remote child id, carrying customization only when the local customization is dirty', async () => {
    const cloudRepo = cloud();
    const localRepo = local({
      readCustomizationSyncMeta: jest
        .fn()
        .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: true }),
    });
    await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefs()).pushForProfile('profile-1');
    expect(cloudRepo.upsert).toHaveBeenCalledWith(
      {
        childId: 'child-remote-1',
        selectedBrushId: 'star-brush',
        selectedBackgroundId: 'cloud-room',
        selectedEffectId: 'gold-sparkle',
        roomConfiguration: roomConfig,
        voiceGuide: 'samet',
        morningReminder: { enabled: true, time: '07:30' },
        eveningReminder: { enabled: false, time: '20:00' },
        dentistReminderEnabled: true,
        dentistLastVisitDate: null,
        dentistNextAppointmentDate: null,
        nicknamePersonalizationEnabled: false,
      },
      { includeCustomization: true },
    );
  });

  it('omits customization from the whole-row push when the local customization is clean (stale foreground push must not clobber another device)', async () => {
    const cloudRepo = cloud();
    const localRepo = local({
      readCustomizationSyncMeta: jest
        .fn()
        .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
    });
    await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefs()).pushForProfile('profile-1');
    expect(cloudRepo.upsert).toHaveBeenCalledWith(expect.any(Object), {
      includeCustomization: false,
    });
    expect(localRepo.markCustomizationSynced).not.toHaveBeenCalled();
  });

  it('reads voice + reminders scoped to the specific child', async () => {
    const prefAccessors = prefs();
    await new ChildPreferencesSyncUseCases(local(), cloud(), prefAccessors).pushForProfile('profile-1');
    expect(prefAccessors.readVoice).toHaveBeenCalledWith('parent-1', 'profile-1');
    expect(prefAccessors.readReminders).toHaveBeenCalledWith('parent-1', 'profile-1');
  });

  it('does not push until the child profile itself is synced', async () => {
    const cloudRepo = cloud();
    const localRepo = local({ resolveRemoteChildId: jest.fn().mockResolvedValue(null) });
    await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefs()).pushForProfile('profile-1');
    expect(cloudRepo.upsert).not.toHaveBeenCalled();
    expect(localRepo.readCustomizationForPush).not.toHaveBeenCalled();
  });

  it('pushes each synced child with its own values on a change', async () => {
    const cloudRepo = cloud();
    const localRepo = local({
      listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-a', 'profile-b']),
      resolveRemoteChildId: jest
        .fn()
        .mockResolvedValueOnce('remote-a')
        .mockResolvedValueOnce('remote-b'),
    });
    await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefs()).pushForAllSyncedChildren();
    expect(cloudRepo.upsert).toHaveBeenCalledTimes(2);
    expect(cloudRepo.upsert.mock.calls[0]?.[0].childId).toBe('remote-a');
    expect(cloudRepo.upsert.mock.calls[1]?.[0].childId).toBe('remote-b');
  });

  describe('pushReminderEdit — field-scoped reminder write (the only cloud reminder write)', () => {
    it('sends only the patched reminder key(s) through patchReminders, scoped to the remote child id', async () => {
      const cloudRepo = cloud();
      await new ChildPreferencesSyncUseCases(local(), cloudRepo, prefs()).pushReminderEdit(
        'profile-1',
        { morning_reminder_enabled: true, morning_reminder_time: '07:00' },
      );
      expect(cloudRepo.patchReminders).toHaveBeenCalledWith('child-remote-1', {
        morning_reminder_enabled: true,
        morning_reminder_time: '07:00',
      });
      // A genuine reminder edit must NEVER go out as a whole-row snapshot.
      expect(cloudRepo.upsert).not.toHaveBeenCalled();
    });

    it('is a no-op for an empty patch', async () => {
      const cloudRepo = cloud();
      await new ChildPreferencesSyncUseCases(local(), cloudRepo, prefs()).pushReminderEdit(
        'profile-1',
        {},
      );
      expect(cloudRepo.patchReminders).not.toHaveBeenCalled();
    });

    it('does not patch until the child profile itself is cloud-synced', async () => {
      const cloudRepo = cloud();
      const localRepo = local({ resolveRemoteChildId: jest.fn().mockResolvedValue(null) });
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefs()).pushReminderEdit(
        'profile-1',
        { evening_reminder_time: '21:30' },
      );
      expect(cloudRepo.patchReminders).not.toHaveBeenCalled();
    });
  });

  describe('whole-row snapshot push never carries reminder columns', () => {
    it('pushForProfile does not send reminder values to the cloud (patchReminders only)', async () => {
      // The Supabase repo drops the reminder columns from the upsert payload
      // (migration m11 revokes the client grant). Recovery-side reminder
      // hydration is unchanged and covered by the recover() tests below.
      const cloudRepo = cloud();
      await new ChildPreferencesSyncUseCases(local(), cloudRepo, prefs()).pushForProfile('profile-1');
      expect(cloudRepo.patchReminders).not.toHaveBeenCalled();
    });
  });

  describe('push safety — never overwrite an existing cloud row with unresolved local defaults', () => {
    it('skips the push entirely when local is unresolved and the cloud already has a row for this child', async () => {
      const cloudRepo = cloud([], { get: jest.fn().mockResolvedValue(cloudRow) });
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(false) });
      const prefAccessors = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(false),
        hasStoredReminders: jest.fn().mockResolvedValue(false),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefAccessors).pushForProfile(
        'profile-1',
      );
      expect(cloudRepo.get).toHaveBeenCalledWith('child-remote-1');
      expect(cloudRepo.upsert).not.toHaveBeenCalled();
      expect(localRepo.markCustomizationSynced).not.toHaveBeenCalled();
      expect(prefAccessors.markRemindersSynced).not.toHaveBeenCalled();
    });

    it('still pushes an unresolved local state when the cloud has no existing row (a genuinely brand-new child)', async () => {
      const cloudRepo = cloud([], { get: jest.fn().mockResolvedValue(null) });
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(false) });
      const prefAccessors = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(false),
        hasStoredReminders: jest.fn().mockResolvedValue(false),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefAccessors).pushForProfile(
        'profile-1',
      );
      expect(cloudRepo.upsert).toHaveBeenCalledTimes(1);
    });

    it('pushes without ever checking the cloud when local is fully resolved (fast path)', async () => {
      const cloudRepo = cloud();
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const prefAccessors = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefAccessors).pushForProfile(
        'profile-1',
      );
      expect(cloudRepo.get).not.toHaveBeenCalled();
      expect(cloudRepo.upsert).toHaveBeenCalledTimes(1);
    });

    it('skips only the unresolved sibling in a bulk push — does not block the resolved one', async () => {
      const cloudRepo = cloud([], { get: jest.fn().mockResolvedValue(cloudRow) });
      const localRepo = local({
        listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-resolved', 'profile-unresolved']),
        resolveRemoteChildId: jest
          .fn()
          .mockResolvedValueOnce('remote-resolved')
          .mockResolvedValueOnce('remote-unresolved'),
        hasLocalCustomization: jest
          .fn()
          .mockResolvedValueOnce(true) // profile-resolved
          .mockResolvedValueOnce(false), // profile-unresolved
      });
      const prefAccessors = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
      });
      await new ChildPreferencesSyncUseCases(
        localRepo,
        cloudRepo,
        prefAccessors,
      ).pushForAllSyncedChildren();
      expect(cloudRepo.upsert).toHaveBeenCalledTimes(1);
      expect(cloudRepo.upsert.mock.calls[0]?.[0].childId).toBe('remote-resolved');
    });
  });

  describe('recover', () => {
    it('hydrates customization + child voice + reschedules reminders when nothing is stored locally', async () => {
      const localRepo = local();
      const prefAccessors = prefs();
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), prefAccessors).recover();
      expect(localRepo.hydrateCustomization).toHaveBeenCalledWith('profile-1', cloudRow);
      expect(prefAccessors.writeVoice).toHaveBeenCalledWith('parent-1', 'profile-1', 'samet');
      expect(prefAccessors.applyRecoveredReminders).toHaveBeenCalledWith('parent-1', 'profile-1', {
        morning: { enabled: true, time: '07:15' },
        evening: { enabled: true, time: '21:00' },
      });
    });

    it('converges a CLEAN local customization to the cloud row (second device catches another device\'s selection), leaves voice/reminders to their own gates', async () => {
      const localRepo = local({
        hasLocalCustomization: jest.fn().mockResolvedValue(true),
        readCustomizationSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-26T00:00:00.000Z', dirty: false }),
      });
      const prefAccessors = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
        // local reminders already equal the cloud row → nothing to converge.
        readReminders: jest.fn().mockResolvedValue({
          morning: { enabled: true, time: '07:15' },
          evening: { enabled: true, time: '21:00' },
        }),
      });
      const cloudRepo = cloud([cloudRow]);
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefAccessors).recover();
      // customization: clean local → hydrate the cloud selection.
      expect(localRepo.hydrateCustomization).toHaveBeenCalledWith('profile-1', cloudRow);
      // recover() is pull-only — never writes the cloud.
      expect(cloudRepo.upsert).not.toHaveBeenCalled();
      // voice/reminders keep their own (unchanged) rules.
      expect(prefAccessors.writeVoice).not.toHaveBeenCalled();
      expect(prefAccessors.applyRecoveredReminders).not.toHaveBeenCalled();
    });

    it('refreshes a CLEAN local customization from the cloud by value, without needing a newer updated_at', async () => {
      const localRepo = local({
        hasLocalCustomization: jest.fn().mockResolvedValue(true),
        readCustomizationSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
      });
      // cloudRow has NO updatedAt — the converge decision is value-based, not
      // timestamp-based (row-wide updated_at also bumps on unrelated writes).
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), prefs()).recover();
      expect(localRepo.hydrateCustomization).toHaveBeenCalledWith('profile-1', cloudRow);
    });

    it('keeps local customization when it holds unpushed edits even if the cloud row is newer', async () => {
      const localRepo = local({
        hasLocalCustomization: jest.fn().mockResolvedValue(true),
        readCustomizationSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: true }),
      });
      const newerRow = { ...cloudRow, updatedAt: '2026-08-25T00:00:00.000Z' };
      await new ChildPreferencesSyncUseCases(localRepo, cloud([newerRow]), prefs()).recover();
      expect(localRepo.hydrateCustomization).not.toHaveBeenCalled();
    });

    it('refreshes a clean-but-stale child voice when the cloud row is newer, keeps a dirty one', async () => {
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const newerRow = { ...cloudRow, updatedAt: '2026-08-25T00:00:00.000Z', voiceGuide: 'off' as const };

      const clean = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
        readVoiceSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloud([newerRow]), clean).recover();
      expect(clean.writeVoice).toHaveBeenCalledWith('parent-1', 'profile-1', 'off');
      expect(clean.markVoiceSynced).toHaveBeenCalledWith('parent-1', 'profile-1', 'off');

      const dirty = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
        readVoiceSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: true }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloud([newerRow]), dirty).recover();
      expect(dirty.writeVoice).not.toHaveBeenCalled();
    });

    it('converges a stored reminder record to the cloud value whenever it differs — even if this device stamped a fresh "synced" marker by foregrounding since', async () => {
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const cloudRepo = cloud([
        {
          ...cloudRow,
          morningReminder: { enabled: true, time: '08:05' },
          eveningReminder: { enabled: true, time: '20:35' },
        },
      ]);
      const stored = prefs({
        readReminders: jest.fn().mockResolvedValue({
          morning: { enabled: false, time: '08:00' },
          evening: { enabled: false, time: '20:30' },
        }),
        readRemindersSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: new Date().toISOString(), dirty: false }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, stored).recover();

      expect(stored.applyRecoveredReminders).toHaveBeenCalledWith('parent-1', 'profile-1', {
        morning: { enabled: true, time: '08:05' },
        evening: { enabled: true, time: '20:35' },
      });
      expect(cloudRepo.upsert).not.toHaveBeenCalled();
      expect(cloudRepo.patchReminders).not.toHaveBeenCalled();
    });

    it('leaves the local reminder record alone when it already matches the cloud (no redundant write)', async () => {
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const row = {
        ...cloudRow,
        morningReminder: { enabled: true, time: '08:05' },
        eveningReminder: { enabled: true, time: '20:35' },
      };
      const stored = prefs({
        readReminders: jest.fn().mockResolvedValue({
          morning: { enabled: true, time: '08:05' },
          evening: { enabled: true, time: '20:35' },
        }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloud([row]), stored).recover();
      expect(stored.applyRecoveredReminders).not.toHaveBeenCalled();
    });

    it('converges a device with NO local reminder record to the cloud value', async () => {
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const row = {
        ...cloudRow,
        morningReminder: { enabled: true, time: '08:05' },
        eveningReminder: { enabled: true, time: '20:35' },
      };
      const fresh = prefs({
        readReminders: jest.fn().mockResolvedValue({
          morning: { enabled: false, time: '08:00' },
          evening: { enabled: false, time: '20:30' },
        }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloud([row]), fresh).recover();
      expect(fresh.applyRecoveredReminders).toHaveBeenCalledWith('parent-1', 'profile-1', {
        morning: { enabled: true, time: '08:05' },
        evening: { enabled: true, time: '20:35' },
      });
    });

    it('end to end (storage-backed): a stale 08:00/20:30 record with a fresh sync marker still converges to the cloud, stays converged across service recreation, and recover never writes the cloud', async () => {
      const values = new Map<string, string>();
      const storage = {
        getItem: async (key: string) => values.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          values.set(key, value);
        },
      };
      const notifications = {
        cancel: jest.fn().mockResolvedValue(undefined),
        getPermission: jest.fn().mockResolvedValue('granted' as const),
        requestPermission: jest.fn().mockResolvedValue('granted' as const),
        schedule: jest.fn().mockResolvedValue('unused'),
        scheduleTest: jest.fn().mockResolvedValue('unused'),
      };
      const row = {
        ...cloudRow,
        updatedAt: '2026-09-09T09:00:00Z',
        morningReminder: { enabled: true, time: '08:01' },
        eveningReminder: { enabled: true, time: '20:31' },
      };
      const before = JSON.stringify(row);
      const cloudRepo = cloud([row]);
      const key = 'parent:parent-1:child:profile-1:brushing-reminders:v1';

      const seedSvc = new ReminderSettingsService(storage, notifications);
      values.set(
        key,
        JSON.stringify({
          morning: { enabled: false, time: '08:00' },
          evening: { enabled: false, time: '20:30' },
        }),
      );
      await seedSvc.markSynced('parent-1', 'profile-1');
      expect(await seedSvc.readSyncMeta('parent-1', 'profile-1')).toMatchObject({ dirty: false });

      const recover = async (service: ReminderSettingsService) => {
        const accessors = prefs({
          readReminders: jest.fn(async (p: string, c: string) => {
            const s = await service.get(p, c);
            return {
              morning: { enabled: s.morning.enabled, time: s.morning.time as string | null },
              evening: { enabled: s.evening.enabled, time: s.evening.time as string | null },
            };
          }),
          hasStoredReminders: jest.fn((p: string, c: string) => service.hasStoredSettings(p, c)),
          applyRecoveredReminders: jest.fn((p: string, c: string, v: Parameters<ReminderSettingsService['applyRecoveredPreferences']>[2]) =>
            service.applyRecoveredPreferences(p, c, v),
          ),
          markRemindersSynced: jest.fn((p: string, c: string) => service.markSynced(p, c)),
        });
        await new ChildPreferencesSyncUseCases(local(), cloudRepo, accessors).recover();
      };

      await recover(new ReminderSettingsService(storage, notifications));
      const reopened = new ReminderSettingsService(storage, notifications);
      await reopened.get('parent-1', 'other-profile');
      await recover(reopened);

      expect(await reopened.get('parent-1', 'profile-1')).toMatchObject({
        morning: { time: '08:01' },
        evening: { time: '20:31' },
      });
      expect(JSON.stringify(row)).toBe(before);
      expect(cloudRepo.upsert).not.toHaveBeenCalled();
      expect(cloudRepo.patchReminders).not.toHaveBeenCalled();
    });

    it('does not fabricate a local reminder record when the cloud has no reminder value', async () => {
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const emptyReminderRow = {
        ...cloudRow,
        updatedAt: '2026-08-25T00:00:00.000Z',
        morningReminder: { enabled: false, time: null },
        eveningReminder: { enabled: false, time: null },
      };
      const stored = prefs();
      await new ChildPreferencesSyncUseCases(localRepo, cloud([emptyReminderRow]), stored).recover();
      expect(stored.applyRecoveredReminders).not.toHaveBeenCalled();
    });
  });

  it('stamps every sync marker after a successful push (customization only when it was dirty)', async () => {
    const localRepo = local({
      readCustomizationSyncMeta: jest
        .fn()
        .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: true }),
    });
    const prefAccessors = prefs();
    await new ChildPreferencesSyncUseCases(localRepo, cloud(), prefAccessors).pushForProfile(
      'profile-1',
    );
    expect(localRepo.markCustomizationSynced).toHaveBeenCalledWith('profile-1', roomConfig);
    expect(prefAccessors.markVoiceSynced).toHaveBeenCalledWith('parent-1', 'profile-1', 'samet');
    // The whole-row upsert no longer carries reminder columns, so it no longer
    // stamps a reminder sync marker (that stale stamp used to block recover()).
    expect(prefAccessors.markRemindersSynced).not.toHaveBeenCalled();
    expect(prefAccessors.markNicknamePersonalizationSynced).toHaveBeenCalledWith(
      'parent-1',
      'profile-1',
      false,
    );
  });

  describe('dentist last-visit / next-appointment sync', () => {
    it('pushes the real local dentist dates, never a hardcoded null', async () => {
      const cloudRepo = cloud();
      const localRepo = local({
        readDentistDatesForPush: jest
          .fn()
          .mockResolvedValue({ lastVisitDate: '2026-06-01', nextAppointmentDate: '2026-12-01' }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefs()).pushForProfile(
        'profile-1',
      );
      expect(cloudRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          dentistLastVisitDate: '2026-06-01',
          dentistNextAppointmentDate: '2026-12-01',
        }),
        expect.objectContaining({ includeCustomization: expect.any(Boolean) }),
      );
    });

    it('hydrates a recovered dentist state only for a child with no local dentist_reminders row yet', async () => {
      const localRepo = local({ dentistReminderEnabled: jest.fn().mockResolvedValue(false) });
      const prefAccessors = prefs();
      const row = {
        ...cloudRow,
        dentistLastVisitDate: '2026-05-10',
        dentistNextAppointmentDate: '2026-11-10',
      };
      await new ChildPreferencesSyncUseCases(localRepo, cloud([row]), prefAccessors).recover();
      expect(localRepo.resolveNickname).toHaveBeenCalledWith('profile-1');
      expect(prefAccessors.applyRecoveredDentist).toHaveBeenCalledWith('profile-1', 'Ada', {
        lastVisitDate: '2026-05-10',
        nextAppointmentDate: '2026-11-10',
      });
    });

    it('never touches a child that already has a local dentist_reminders row', async () => {
      const localRepo = local({ dentistReminderEnabled: jest.fn().mockResolvedValue(true) });
      const prefAccessors = prefs();
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), prefAccessors).recover();
      expect(prefAccessors.applyRecoveredDentist).not.toHaveBeenCalled();
    });

    it('recovers dentist state even when the child has no parentUserId resolved yet', async () => {
      const localRepo = local({
        dentistReminderEnabled: jest.fn().mockResolvedValue(false),
        resolveParentUserId: jest.fn().mockResolvedValue(null),
      });
      const prefAccessors = prefs();
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), prefAccessors).recover();
      expect(prefAccessors.applyRecoveredDentist).toHaveBeenCalled();
    });

    it('treats an unresolved dentist state as unsafe to push against an existing cloud row', async () => {
      const cloudRepo = cloud([], { get: jest.fn().mockResolvedValue(cloudRow) });
      const localRepo = local({
        hasLocalCustomization: jest.fn().mockResolvedValue(true),
        dentistReminderEnabled: jest.fn().mockResolvedValue(false),
      });
      const prefAccessors = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
        hasStoredNicknamePersonalization: jest.fn().mockResolvedValue(true),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, prefAccessors).pushForProfile(
        'profile-1',
      );
      expect(cloudRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('nickname personalization sync', () => {
    it('hydrates a recovered value only for a child with no local record yet', async () => {
      const localRepo = local();
      const prefAccessors = prefs({
        hasStoredNicknamePersonalization: jest.fn().mockResolvedValue(false),
      });
      const row = { ...cloudRow, nicknamePersonalizationEnabled: true };
      await new ChildPreferencesSyncUseCases(localRepo, cloud([row]), prefAccessors).recover();
      expect(prefAccessors.writeNicknamePersonalization).toHaveBeenCalledWith(
        'parent-1',
        'profile-1',
        true,
      );
      expect(prefAccessors.markNicknamePersonalizationSynced).toHaveBeenCalledWith(
        'parent-1',
        'profile-1',
        true,
      );
    });

    it('never overwrites a locally-set value that is dirty, even when the cloud row is newer', async () => {
      const localRepo = local();
      const prefAccessors = prefs({
        hasStoredNicknamePersonalization: jest.fn().mockResolvedValue(true),
        readNicknamePersonalizationSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: true }),
      });
      const row = {
        ...cloudRow,
        nicknamePersonalizationEnabled: true,
        updatedAt: '2026-08-25T00:00:00.000Z',
      };
      await new ChildPreferencesSyncUseCases(localRepo, cloud([row]), prefAccessors).recover();
      expect(prefAccessors.writeNicknamePersonalization).not.toHaveBeenCalled();
    });

    it('does nothing when the cloud has never resolved this preference (null)', async () => {
      const localRepo = local();
      const prefAccessors = prefs();
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), prefAccessors).recover();
      expect(prefAccessors.writeNicknamePersonalization).not.toHaveBeenCalled();
    });
  });
});
