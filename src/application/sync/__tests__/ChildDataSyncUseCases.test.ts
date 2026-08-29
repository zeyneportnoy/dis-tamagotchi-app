import type { CloudChildDataRepository, LocalChildCloudSyncRepository } from '@/domain/sync';

import { ChildDataSyncUseCases } from '../ChildDataSyncUseCases';

const local = (
  overrides: Partial<jest.Mocked<LocalChildCloudSyncRepository>> = {},
): jest.Mocked<LocalChildCloudSyncRepository> => ({
  resolveRemoteChildId: jest.fn().mockResolvedValue('child-remote-1'),
  readProgressForPush: jest.fn().mockResolvedValue({ currentMineScore: 240, streak: 3 }),
  readSessionForPush: jest.fn().mockResolvedValue({
    id: 'session-1',
    localDayKey: '2026-08-29',
    period: 'morning',
    startedAt: '2026-08-29T06:00:00.000Z',
    completedAt: '2026-08-29T06:02:00.000Z',
    status: 'completed',
    rewardMine: 20,
    timezoneOffsetMinutes: -180,
  }),
  readRecentEvaluationsForPush: jest.fn().mockResolvedValue([
    {
      localDayKey: '2026-08-29',
      period: 'morning',
      outcome: 'missed',
      penaltyMine: -10,
      evaluatedAt: '2026-08-29T12:00:00.000Z',
    },
  ]),
  findHydratableProfile: jest.fn().mockResolvedValue('profile-1'),
  hydrateProgress: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const cloud = (): jest.Mocked<CloudChildDataRepository> => ({
  upsertProgress: jest.fn().mockResolvedValue(undefined),
  upsertSession: jest.fn().mockResolvedValue(undefined),
  upsertSlotEvaluation: jest.fn().mockResolvedValue(undefined),
  listOwnedProgress: jest.fn().mockResolvedValue([
    { childId: 'child-remote-1', currentMineScore: 240, streak: 4 },
    { childId: 'child-remote-2', currentMineScore: 80, streak: 1 },
  ]),
});

describe('ChildDataSyncUseCases', () => {
  it('pushes Mine Puan + streak scoped to the resolved remote child id', async () => {
    const localRepo = local();
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushProgress('profile-1');
    expect(cloudRepo.upsertProgress).toHaveBeenCalledWith({
      childId: 'child-remote-1',
      currentMineScore: 240,
      streak: 3,
    });
  });

  it('does not push dependent data until the child profile itself is synced', async () => {
    const localRepo = local({ resolveRemoteChildId: jest.fn().mockResolvedValue(null) });
    const cloudRepo = cloud();
    const useCases = new ChildDataSyncUseCases(localRepo, cloudRepo);
    await useCases.pushProgress('profile-1');
    await useCases.pushSession('profile-1', 'session-1');
    await useCases.pushRecentEvaluations('profile-1', '2026-08-15');
    expect(cloudRepo.upsertProgress).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSession).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSlotEvaluation).not.toHaveBeenCalled();
    expect(localRepo.readProgressForPush).not.toHaveBeenCalled();
  });

  it('pushes a session under its stable local id merged with the remote child id', async () => {
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(local(), cloudRepo).pushSession('profile-1', 'session-1');
    expect(cloudRepo.upsertSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1', childId: 'child-remote-1', rewardMine: 20 }),
    );
  });

  it('upserts each recent slot evaluation on its composite identity', async () => {
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(local(), cloudRepo).pushRecentEvaluations(
      'profile-1',
      '2026-08-15',
    );
    expect(cloudRepo.upsertSlotEvaluation).toHaveBeenCalledTimes(1);
    expect(cloudRepo.upsertSlotEvaluation).toHaveBeenCalledWith({
      childId: 'child-remote-1',
      localDayKey: '2026-08-29',
      period: 'morning',
      outcome: 'missed',
      penaltyMine: -10,
      evaluatedAt: '2026-08-29T12:00:00.000Z',
    });
  });

  it('hydrates only the children that have no local progress row yet', async () => {
    const localRepo = local({
      findHydratableProfile: jest
        .fn()
        .mockResolvedValueOnce('profile-a')
        .mockResolvedValueOnce(null), // profile B already has local data — not overwritten
    });
    const cloudRepo = cloud();
    await expect(
      new ChildDataSyncUseCases(localRepo, cloudRepo).recoverProgress(),
    ).resolves.toBe(1);
    expect(localRepo.hydrateProgress).toHaveBeenCalledTimes(1);
    expect(localRepo.hydrateProgress).toHaveBeenCalledWith('profile-a', {
      childId: 'child-remote-1',
      currentMineScore: 240,
      streak: 4,
    });
  });
});
