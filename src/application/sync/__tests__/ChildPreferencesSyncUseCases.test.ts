import type {
  CloudChildPreferences,
  CloudChildPreferencesRepository,
  LocalChildPreferenceSyncRepository,
} from '@/domain/sync';

import {
  ChildPreferencesSyncUseCases,
  type ParentPreferenceAccessors,
} from '../ChildPreferencesSyncUseCases';

const roomConfig = {
  developerEquipped: { brush: 'star-brush', background: 'cloud-room', effect: 'gold-sparkle' },
  placements: { 'pastel-toy-box': { scale: 1, x: 0.4, y: 0.7 } },
  selectedRoomMaterials: ['pastel-toy-box'],
  version: 1,
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
  ...overrides,
});

const cloud = (
  rows: readonly CloudChildPreferences[] = [],
): jest.Mocked<CloudChildPreferencesRepository> => ({
  upsert: jest.fn().mockResolvedValue(undefined),
  listOwned: jest.fn().mockResolvedValue(rows),
});

const parents = (
  overrides: Partial<jest.Mocked<ParentPreferenceAccessors>> = {},
): jest.Mocked<ParentPreferenceAccessors> => ({
  readVoice: jest.fn().mockResolvedValue('samet'),
  hasStoredVoice: jest.fn().mockResolvedValue(false),
  writeVoice: jest.fn().mockResolvedValue(undefined),
  readReminders: jest.fn().mockResolvedValue({
    morning: { enabled: true, time: '07:30' },
    evening: { enabled: false, time: '20:00' },
  }),
  hasStoredReminders: jest.fn().mockResolvedValue(false),
  writeReminders: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('ChildPreferencesSyncUseCases', () => {
  it('pushes a full preference snapshot scoped to the remote child id', async () => {
    const cloudRepo = cloud();
    await new ChildPreferencesSyncUseCases(local(), cloudRepo, parents()).pushForProfile('profile-1');
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

  it('does not push until the child profile itself is synced', async () => {
    const cloudRepo = cloud();
    const localRepo = local({ resolveRemoteChildId: jest.fn().mockResolvedValue(null) });
    await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, parents()).pushForProfile('profile-1');
    expect(cloudRepo.upsert).not.toHaveBeenCalled();
    expect(localRepo.readCustomizationForPush).not.toHaveBeenCalled();
  });

  it('pushes once per synced child on a parent-level preference change', async () => {
    const cloudRepo = cloud();
    const localRepo = local({
      listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-a', 'profile-b']),
      resolveRemoteChildId: jest
        .fn()
        .mockResolvedValueOnce('remote-a')
        .mockResolvedValueOnce('remote-b'),
    });
    await new ChildPreferencesSyncUseCases(localRepo, cloudRepo, parents()).pushForAllSyncedChildren();
    expect(cloudRepo.upsert).toHaveBeenCalledTimes(2);
    expect(cloudRepo.upsert.mock.calls[0]?.[0].childId).toBe('remote-a');
    expect(cloudRepo.upsert.mock.calls[1]?.[0].childId).toBe('remote-b');
  });

  describe('recover', () => {
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

    it('hydrates customization + parent preferences when nothing is stored locally', async () => {
      const localRepo = local();
      const parentAccessors = parents();
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), parentAccessors).recover();
      expect(localRepo.hydrateCustomization).toHaveBeenCalledWith('profile-1', roomConfig);
      expect(parentAccessors.writeVoice).toHaveBeenCalledWith('parent-1', 'samet');
      expect(parentAccessors.writeReminders).toHaveBeenCalledWith('parent-1', {
        morning: { enabled: true, time: '07:15' },
        evening: { enabled: true, time: '21:00' },
      });
    });

    it('never overwrites local customization / voice / reminders that already exist', async () => {
      const localRepo = local({ hasLocalCustomization: jest.fn().mockResolvedValue(true) });
      const parentAccessors = parents({
        hasStoredVoice: jest.fn().mockResolvedValue(true),
        hasStoredReminders: jest.fn().mockResolvedValue(true),
      });
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), parentAccessors).recover();
      expect(localRepo.hydrateCustomization).not.toHaveBeenCalled();
      expect(parentAccessors.writeVoice).not.toHaveBeenCalled();
      expect(parentAccessors.writeReminders).not.toHaveBeenCalled();
    });

    it('hydrates the cloud selection verbatim — the render-time unlock guard still governs it', async () => {
      // Recovery does not resolve locked/unlocked; it stores the raw choice and
      // the existing effective*Key guards keep a locked item inactive.
      const localRepo = local();
      await new ChildPreferencesSyncUseCases(localRepo, cloud([cloudRow]), parents()).recover();
      const [, storedConfig] = localRepo.hydrateCustomization.mock.calls[0] ?? [];
      expect((storedConfig as typeof roomConfig).developerEquipped.brush).toBe('star-brush');
    });
  });
});
