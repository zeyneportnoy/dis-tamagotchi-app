import type {
  CloudBrushingSession,
  CloudChildDataRepository,
  CloudChildProgress,
  CloudSlotEvaluation,
  LocalChildCloudSyncRepository,
  LocalProgressSnapshot,
} from '@/domain/sync';

import { ChildDataSyncUseCases } from '../ChildDataSyncUseCases';

const snapshot = (over: Partial<LocalProgressSnapshot> = {}): LocalProgressSnapshot => ({
  currentMineScore: 240,
  streak: 3,
  syncedAt: '2026-08-20T00:00:00.000Z',
  syncedScore: 240,
  syncedStreak: 3,
  ...over,
});

const local = (
  over: Partial<jest.Mocked<LocalChildCloudSyncRepository>> = {},
): jest.Mocked<LocalChildCloudSyncRepository> => ({
  resolveRemoteChildId: jest.fn().mockResolvedValue('remote-1'),
  listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-1']),
  findProfileByRemoteChildId: jest.fn().mockResolvedValue('profile-1'),
  readProgressSnapshot: jest.fn().mockResolvedValue(snapshot()),
  writeRecoveredProgress: jest.fn().mockResolvedValue(undefined),
  markProgressSynced: jest.fn().mockResolvedValue(undefined),
  readUnsyncedSessions: jest.fn().mockResolvedValue([]),
  markSessionSynced: jest.fn().mockResolvedValue(undefined),
  hydrateSession: jest.fn().mockResolvedValue(undefined),
  readUnsyncedEvaluations: jest.fn().mockResolvedValue([]),
  markEvaluationSynced: jest.fn().mockResolvedValue(undefined),
  hydrateSlotEvaluation: jest.fn().mockResolvedValue(undefined),
  ...over,
});

const cloud = (
  over: Partial<jest.Mocked<CloudChildDataRepository>> = {},
): jest.Mocked<CloudChildDataRepository> => ({
  upsertProgress: jest.fn().mockResolvedValue('2026-08-25T00:00:00.000Z'),
  upsertSession: jest.fn().mockResolvedValue('2026-08-25T00:00:00.000Z'),
  upsertSlotEvaluation: jest.fn().mockResolvedValue('2026-08-25T00:00:00.000Z'),
  getProgress: jest.fn().mockResolvedValue(null),
  listOwnedProgress: jest.fn().mockResolvedValue([]),
  listOwnedSessions: jest.fn().mockResolvedValue([]),
  listOwnedSlotEvaluations: jest.fn().mockResolvedValue([]),
  ...over,
});

describe('ChildDataSyncUseCases — push', () => {
  it('pushes progress scoped to the remote child id and stamps the sync markers', async () => {
    const localRepo = local();
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushProgress('profile-1');
    expect(cloudRepo.upsertProgress).toHaveBeenCalledWith({
      childId: 'remote-1',
      currentMineScore: 240,
      streak: 3,
    });
    expect(localRepo.markProgressSynced).toHaveBeenCalledWith(
      'profile-1',
      240,
      3,
      '2026-08-25T00:00:00.000Z',
    );
  });

  it('does not push anything while the child profile is not cloud-synced', async () => {
    const localRepo = local({ resolveRemoteChildId: jest.fn().mockResolvedValue(null) });
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');
    expect(cloudRepo.upsertProgress).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSession).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSlotEvaluation).not.toHaveBeenCalled();
  });

  it('pushChild flushes a dirty score, unsynced sessions and unsynced evaluations', async () => {
    const session: Omit<CloudBrushingSession, 'childId'> = {
      id: 'sess-1',
      localDayKey: '2026-08-24',
      period: 'morning',
      startedAt: '2026-08-24T06:00:00.000Z',
      completedAt: '2026-08-24T06:02:00.000Z',
      status: 'completed',
      rewardMine: 20,
      timezoneOffsetMinutes: -180,
    };
    const evaluation: Omit<CloudSlotEvaluation, 'childId'> = {
      localDayKey: '2026-08-23',
      period: 'evening',
      outcome: 'missed',
      penaltyMine: -10,
      appliedPenaltyMine: -10,
      evaluatedAt: '2026-08-24T00:00:00.000Z',
    };
    const localRepo = local({
      readProgressSnapshot: jest
        .fn()
        .mockResolvedValue(snapshot({ currentMineScore: 260, syncedScore: 240 })),
      readUnsyncedSessions: jest.fn().mockResolvedValue([session]),
      readUnsyncedEvaluations: jest.fn().mockResolvedValue([evaluation]),
    });
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');

    expect(cloudRepo.upsertProgress).toHaveBeenCalledWith({
      childId: 'remote-1',
      currentMineScore: 260,
      streak: 3,
    });
    expect(cloudRepo.upsertSession).toHaveBeenCalledWith({ ...session, childId: 'remote-1' });
    expect(localRepo.markSessionSynced).toHaveBeenCalledWith('sess-1', '2026-08-25T00:00:00.000Z');
    expect(cloudRepo.upsertSlotEvaluation).toHaveBeenCalledWith({
      ...evaluation,
      childId: 'remote-1',
    });
    expect(localRepo.markEvaluationSynced).toHaveBeenCalledWith(
      'profile-1',
      '2026-08-23',
      'evening',
      '2026-08-25T00:00:00.000Z',
    );
  });

  it('pushChild skips a clean score (current == last synced)', async () => {
    const localRepo = local(); // snapshot() is already clean
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');
    expect(cloudRepo.upsertProgress).not.toHaveBeenCalled();
  });

  it('does not overwrite a cloud row that advanced past this device since its last sync', async () => {
    const localRepo = local({
      readProgressSnapshot: jest.fn().mockResolvedValue(
        snapshot({
          currentMineScore: 260, // dirty local edit
          syncedScore: 240,
          syncedStreak: 3,
          streak: 3,
          syncedAt: '2026-08-20T00:00:00.000Z',
        }),
      ),
    });
    const cloudRepo = cloud({
      // Another device pushed 300 after our last sync at 2026-08-20.
      getProgress: jest.fn().mockResolvedValue({
        childId: 'remote-1',
        currentMineScore: 300,
        streak: 4,
        updatedAt: '2026-08-24T00:00:00.000Z',
      }),
    });
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushProgress('profile-1');
    expect(cloudRepo.upsertProgress).not.toHaveBeenCalled();
    expect(localRepo.markProgressSynced).not.toHaveBeenCalled();
  });

  it('still pushes when the cloud row has not advanced past our last sync', async () => {
    const localRepo = local({
      readProgressSnapshot: jest.fn().mockResolvedValue(
        snapshot({ currentMineScore: 260, syncedScore: 240, syncedAt: '2026-08-24T00:00:00.000Z' }),
      ),
    });
    const cloudRepo = cloud({
      getProgress: jest.fn().mockResolvedValue({
        childId: 'remote-1',
        currentMineScore: 240,
        streak: 3,
        updatedAt: '2026-08-20T00:00:00.000Z', // older than our syncedAt
      }),
    });
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushProgress('profile-1');
    expect(cloudRepo.upsertProgress).toHaveBeenCalledWith({
      childId: 'remote-1',
      currentMineScore: 260,
      streak: 3,
    });
  });
});

describe('ChildDataSyncUseCases — progress recovery (multi-device)', () => {
  const cloudRow: CloudChildProgress = {
    childId: 'remote-1',
    currentMineScore: 640,
    streak: 5,
    updatedAt: '2026-08-25T00:00:00.000Z',
  };

  it('hydrates when there is no local progress row', async () => {
    const localRepo = local({ readProgressSnapshot: jest.fn().mockResolvedValue(null) });
    await new ChildDataSyncUseCases(localRepo, cloud({ listOwnedProgress: jest.fn().mockResolvedValue([cloudRow]) })).recoverProgress();
    expect(localRepo.writeRecoveredProgress).toHaveBeenCalledWith('profile-1', cloudRow);
  });

  it('refreshes a clean local row when the cloud row is newer', async () => {
    const localRepo = local({
      readProgressSnapshot: jest.fn().mockResolvedValue(
        snapshot({
          currentMineScore: 600,
          streak: 4,
          syncedScore: 600,
          syncedStreak: 4,
          syncedAt: '2026-08-20T00:00:00.000Z',
        }),
      ),
    });
    await new ChildDataSyncUseCases(
      localRepo,
      cloud({ listOwnedProgress: jest.fn().mockResolvedValue([cloudRow]) }),
    ).recoverProgress();
    expect(localRepo.writeRecoveredProgress).toHaveBeenCalledWith('profile-1', cloudRow);
  });

  it('never overwrites a local row that holds unpushed edits', async () => {
    const localRepo = local({
      readProgressSnapshot: jest.fn().mockResolvedValue(
        snapshot({ currentMineScore: 660, syncedScore: 640, syncedStreak: 5, streak: 5 }),
      ),
    });
    await new ChildDataSyncUseCases(
      localRepo,
      cloud({ listOwnedProgress: jest.fn().mockResolvedValue([cloudRow]) }),
    ).recoverProgress();
    expect(localRepo.writeRecoveredProgress).not.toHaveBeenCalled();
  });

  it('does nothing when the cloud row is not newer than this device', async () => {
    const localRepo = local({
      readProgressSnapshot: jest.fn().mockResolvedValue(
        snapshot({
          currentMineScore: 640,
          streak: 5,
          syncedScore: 640,
          syncedStreak: 5,
          syncedAt: '2026-08-26T00:00:00.000Z',
        }),
      ),
    });
    await new ChildDataSyncUseCases(
      localRepo,
      cloud({ listOwnedProgress: jest.fn().mockResolvedValue([cloudRow]) }),
    ).recoverProgress();
    expect(localRepo.writeRecoveredProgress).not.toHaveBeenCalled();
  });
});

describe('ChildDataSyncUseCases — brushing history recovery', () => {
  it('hydrates sessions and slot evaluations per owning child, idempotently', async () => {
    const sessionA: CloudBrushingSession = {
      id: 'a1',
      childId: 'remote-a',
      localDayKey: '2026-08-24',
      period: 'morning',
      startedAt: '2026-08-24T06:00:00.000Z',
      completedAt: '2026-08-24T06:02:00.000Z',
      status: 'completed',
      rewardMine: 20,
      timezoneOffsetMinutes: -180,
      updatedAt: '2026-08-24T06:02:01.000Z',
    };
    const evalB: CloudSlotEvaluation = {
      childId: 'remote-b',
      localDayKey: '2026-08-23',
      period: 'evening',
      outcome: 'missed',
      penaltyMine: -10,
      appliedPenaltyMine: -10,
      evaluatedAt: '2026-08-24T00:00:00.000Z',
      updatedAt: '2026-08-24T00:00:01.000Z',
    };
    const localRepo = local({
      findProfileByRemoteChildId: jest
        .fn()
        .mockImplementation((id: string) => Promise.resolve(id === 'remote-a' ? 'profile-a' : 'profile-b')),
    });
    await new ChildDataSyncUseCases(
      localRepo,
      cloud({
        listOwnedSessions: jest.fn().mockResolvedValue([sessionA]),
        listOwnedSlotEvaluations: jest.fn().mockResolvedValue([evalB]),
      }),
    ).recoverBrushingHistory();

    expect(localRepo.hydrateSession).toHaveBeenCalledWith('profile-a', sessionA);
    expect(localRepo.hydrateSlotEvaluation).toHaveBeenCalledWith('profile-b', evalB);
  });
});

describe('ChildDataSyncUseCases — pushAllPending', () => {
  it('flushes every synced child', async () => {
    const localRepo = local({
      listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-a', 'profile-b']),
      resolveRemoteChildId: jest.fn().mockResolvedValue('remote-x'),
      readProgressSnapshot: jest
        .fn()
        .mockResolvedValue(snapshot({ currentMineScore: 300, syncedScore: 240 })),
    });
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushAllPending();
    expect(cloudRepo.upsertProgress).toHaveBeenCalledTimes(2);
  });
});
