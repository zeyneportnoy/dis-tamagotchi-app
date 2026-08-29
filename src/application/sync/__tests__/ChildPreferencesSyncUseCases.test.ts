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
): jest.Mocked<CloudChildPreferencesRepository> => ({
  upsert: jest.fn().mockResolvedValue(undefined),
  listOwned: jest.fn().mockResolvedValue(rows),
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
  ...overrides,
});

describe('ChildPreferencesSyncUseCases', () => {
  it('pushes a full preference snapshot scoped to the remote child id', async () => {
    const cloudRepo = cloud();
    await new ChildPreferencesSyncUseCases(local(), cloudRepo, prefs()).pushForProfile('profile-1');
    expect(cloudRepo.upsert).toHaveBeenCalledWith({
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
    });
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

    it('never overwrites local customization / voice / reminders that already exist and are clean-but-not-stale', async () => {
      const localRepo = local({
        hasLocalCustomization: jest.fn().mockResolvedValue(true),
        readCustomizationSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-26T00:00:00.000Z', dirty: false }),
      });
      const prefAccessors = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
      });
      // cloudRow has no updatedAt → not newer.
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), prefAccessors).recover();
      expect(localRepo.hydrateCustomization).not.toHaveBeenCalled();
      expect(prefAccessors.writeVoice).not.toHaveBeenCalled();
      expect(prefAccessors.applyRecoveredReminders).not.toHaveBeenCalled();
    });

    it('refreshes customization when local is clean and the cloud row is newer', async () => {
      const localRepo = local({
        hasLocalCustomization: jest.fn().mockResolvedValue(true),
        readCustomizationSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
      });
      const newerRow = { ...cloudRow, updatedAt: '2026-08-25T00:00:00.000Z' };
      await new ChildPreferencesSyncUseCases(localRepo, cloud([newerRow]), prefs()).recover();
      expect(localRepo.hydrateCustomization).toHaveBeenCalledWith('profile-1', newerRow);
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

    it('refreshes clean-but-stale child reminders when the cloud row is newer, keeps a dirty one', async () => {
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const newerRow = { ...cloudRow, updatedAt: '2026-08-25T00:00:00.000Z' };

      const clean = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
        readRemindersSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: false }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloud([newerRow]), clean).recover();
      expect(clean.applyRecoveredReminders).toHaveBeenCalledWith('parent-1', 'profile-1', {
        morning: { enabled: true, time: '07:15' },
        evening: { enabled: true, time: '21:00' },
      });
      expect(clean.markRemindersSynced).toHaveBeenCalledWith('parent-1', 'profile-1');

      const dirty = prefs({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
        readRemindersSyncMeta: jest
          .fn()
          .mockResolvedValue({ syncedAt: '2026-08-20T00:00:00.000Z', dirty: true }),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloud([newerRow]), dirty).recover();
      expect(dirty.applyRecoveredReminders).not.toHaveBeenCalled();
    });
  });

  it('stamps every sync marker after a successful push', async () => {
    const localRepo = local();
    const prefAccessors = prefs();
    await new ChildPreferencesSyncUseCases(localRepo, cloud(), prefAccessors).pushForProfile(
      'profile-1',
    );
    expect(localRepo.markCustomizationSynced).toHaveBeenCalledWith('profile-1', roomConfig);
    expect(prefAccessors.markVoiceSynced).toHaveBeenCalledWith('parent-1', 'profile-1', 'samet');
    expect(prefAccessors.markRemindersSynced).toHaveBeenCalledWith('parent-1', 'profile-1');
  });
});
