import type { BrushingSessionRepository, ProfileProgress, ProfileProgressRepository } from '@/domain/family';
import type { InventoryRepository, RewardSessionRepository } from '@/domain/rewards';

jest.mock('@/application/sync', () => ({
  ensureChildDataRecovered: jest.fn().mockResolvedValue(undefined),
  syncChildBrushingSession: jest.fn().mockResolvedValue(undefined),
  syncChildCloudProgress: jest.fn().mockResolvedValue(undefined),
  syncChildPreferences: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line import/order
import { ensureChildDataRecovered, syncChildPreferences } from '@/application/sync';

import { CloudAwareChildExperienceUseCases } from '../services';

const progress: ProfileProgress = {
  childProfileId: 'profile-1',
  statusDate: '2026-08-29',
  morningCompleted: false,
  eveningCompleted: false,
  currentStreak: 3,
  totalXp: 100,
  level: 1,
  mood: 50,
  lastInteractionAt: null,
  lastBrushingAt: null,
};

const sessions = (): jest.Mocked<BrushingSessionRepository & RewardSessionRepository> => ({
  complete: jest.fn(),
  listCompleted: jest.fn().mockResolvedValue([]),
  begin: jest.fn().mockResolvedValue(undefined),
  finish: jest.fn(),
  reconcileMissedSlots: jest.fn().mockResolvedValue([]),
});

const progressRepo = (): jest.Mocked<ProfileProgressRepository> => ({
  get: jest.fn().mockResolvedValue(progress),
  setBrushingCompleted: jest.fn(),
});

const inventory = (): jest.Mocked<InventoryRepository> => ({
  list: jest.fn().mockResolvedValue([]),
  equip: jest.fn().mockResolvedValue(undefined),
  unequipSlot: jest.fn().mockResolvedValue(undefined),
  getEquipped: jest.fn().mockResolvedValue(null),
  getEquippedItems: jest.fn().mockResolvedValue([]),
});

describe('CloudAwareChildExperienceUseCases.getProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('awaits cloud history recovery before missed-slot reconciliation ever runs', async () => {
    const callOrder: string[] = [];
    (ensureChildDataRecovered as jest.Mock).mockImplementation(async () => {
      callOrder.push('recovered');
    });
    const sessionsRepo = sessions();
    sessionsRepo.reconcileMissedSlots.mockImplementation(async () => {
      callOrder.push('reconciled');
      return [];
    });

    const useCases = new CloudAwareChildExperienceUseCases(
      progressRepo(),
      sessionsRepo,
      inventory(),
    );
    await useCases.getProgress('profile-1');

    expect(callOrder).toEqual(['recovered', 'reconciled']);
  });

  it('every call to getProgress re-checks the (memoized) recovery gate — no screen can bypass it', async () => {
    const sessionsRepo = sessions();
    const useCases = new CloudAwareChildExperienceUseCases(
      progressRepo(),
      sessionsRepo,
      inventory(),
    );

    await useCases.getProgress('profile-1');
    await useCases.getProgress('profile-1');

    expect(ensureChildDataRecovered).toHaveBeenCalledTimes(2);
    expect(sessionsRepo.reconcileMissedSlots).toHaveBeenCalledTimes(2);
  });

  it('never silently skips the gate — a broken recovery contract fails loudly instead of reconciling anyway', async () => {
    // ensureChildDataRecovered swallows every internal failure by contract
    // (see application/sync/services.ts), so it never actually rejects in
    // production. This asserts getProgress does not add its own try/catch
    // around the gate that could mask a future violation of that contract and
    // let reconciliation run unguarded.
    (ensureChildDataRecovered as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const sessionsRepo = sessions();
    const useCases = new CloudAwareChildExperienceUseCases(
      progressRepo(),
      sessionsRepo,
      inventory(),
    );

    await expect(useCases.getProgress('profile-1')).rejects.toThrow('offline');
    expect(sessionsRepo.reconcileMissedSlots).not.toHaveBeenCalled();
  });

  it('equipItem pushes a cloud preference update — including when the base class calls it internally', async () => {
    // ChildExperienceUseCases.getProgress's private ensureEquippedItemsAreStillUnlocked
    // auto-reverts a now-relocked equip (score dropped below its threshold) by
    // calling `this.equipItem(...)`. Because `this` is the actual
    // CloudAwareChildExperienceUseCases instance at runtime, that call
    // dispatches polymorphically to THIS override — the audit's finding was
    // that the production auto-revert path was therefore ALREADY wired to
    // push, unlike the separate AsyncStorage-only __DEV__ override path. This
    // asserts the one fact that guarantee rests on: equipItem always pushes,
    // regardless of whether a screen or internal reconciliation called it.
    const useCases = new CloudAwareChildExperienceUseCases(
      progressRepo(),
      sessions(),
      inventory(),
    );

    await useCases.equipItem('profile-1', 'classic-brush' as never);

    expect(syncChildPreferences).toHaveBeenCalledWith('profile-1');
  });
});
