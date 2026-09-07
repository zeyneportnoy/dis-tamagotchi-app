import type {
  AuthoritativeProgress,
  CloudBrushingSession,
  CloudChildDataRepository,
  CloudChildProgress,
  CloudSlotEvaluation,
  LocalChildCloudSyncRepository,
} from '@/domain/sync';

import { ChildDataSyncUseCases } from '../ChildDataSyncUseCases';

const authoritative = (over: Partial<AuthoritativeProgress> = {}): AuthoritativeProgress => ({
  childId: 'remote-1',
  xpGranted: 20,
  penaltyApplied: 0,
  currentMineScore: 260,
  streak: 3,
  morningCompleted: true,
  eveningCompleted: false,
  alreadyResolved: false,
  updatedAt: '2099-01-01T00:00:05.000Z',
  ...over,
});

const local = (
  over: Partial<jest.Mocked<LocalChildCloudSyncRepository>> = {},
): jest.Mocked<LocalChildCloudSyncRepository> => ({
  resolveRemoteChildId: jest.fn().mockResolvedValue('remote-1'),
  listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-1']),
  findProfileByRemoteChildId: jest.fn().mockResolvedValue('profile-1'),
  readProgressSnapshot: jest.fn().mockResolvedValue(null),
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
  claimBrushingSlot: jest.fn().mockResolvedValue(authoritative()),
  applySlotPenalty: jest
    .fn()
    .mockResolvedValue(authoritative({ xpGranted: 0, penaltyApplied: -10, currentMineScore: 230 })),
  upsertSession: jest.fn().mockResolvedValue('2099-01-01T00:00:09.000Z'),
  upsertSlotEvaluation: jest.fn().mockResolvedValue('2099-01-01T00:00:09.000Z'),
  getProgress: jest.fn().mockResolvedValue(null),
  listOwnedProgress: jest.fn().mockResolvedValue([]),
  listOwnedSessions: jest.fn().mockResolvedValue([]),
  listOwnedSlotEvaluations: jest.fn().mockResolvedValue([]),
  ...over,
});

const completedSession = (
  over: Partial<Omit<CloudBrushingSession, 'childId'>> = {},
): Omit<CloudBrushingSession, 'childId'> => ({
  id: 'sess-1',
  localDayKey: '2026-08-24',
  period: 'morning',
  startedAt: '2026-08-24T06:00:00.000Z',
  completedAt: '2026-08-24T06:02:00.000Z',
  status: 'completed',
  rewardMine: 20,
  timezoneOffsetMinutes: -180,
  ...over,
});

describe('ChildDataSyncUseCases — the client never sends an absolute score', () => {
  it('has no pushProgress method and the cloud repo has no upsertProgress', () => {
    const sync = new ChildDataSyncUseCases(local(), cloud());
    // @ts-expect-error — pushProgress was deleted; only per-slot claims remain.
    expect(sync.pushProgress).toBeUndefined();
    // @ts-expect-error — upsertProgress was removed from the interface.
    expect(cloud().upsertProgress).toBeUndefined();
  });

  it('does nothing while the child profile is not cloud-synced', async () => {
    const localRepo = local({ resolveRemoteChildId: jest.fn().mockResolvedValue(null) });
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');
    expect(cloudRepo.claimBrushingSlot).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSession).not.toHaveBeenCalled();
    expect(cloudRepo.applySlotPenalty).not.toHaveBeenCalled();
  });

  it('pushChild with nothing pending makes no cloud call at all', async () => {
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(local(), cloudRepo).pushChild('profile-1');
    expect(cloudRepo.claimBrushingSlot).not.toHaveBeenCalled();
    expect(cloudRepo.applySlotPenalty).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSession).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSlotEvaluation).not.toHaveBeenCalled();
  });
});

describe('ChildDataSyncUseCases — session flush', () => {
  it('presents a completed rewarded slot to the atomic claim and writes the authoritative result back', async () => {
    const session = completedSession();
    const localRepo = local({ readUnsyncedSessions: jest.fn().mockResolvedValue([session]) });
    const cloudRepo = cloud();

    const claims = await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');

    expect(cloudRepo.claimBrushingSlot).toHaveBeenCalledWith({
      childId: 'remote-1',
      sessionId: 'sess-1',
      localDayKey: '2026-08-24',
      period: 'morning',
      startedAt: '2026-08-24T06:00:00.000Z',
      completedAt: '2026-08-24T06:02:00.000Z',
      timezoneOffsetMinutes: -180,
    });
    // authoritative score/streak → local cache (no absolute value proposed by us)
    expect(localRepo.writeRecoveredProgress).toHaveBeenCalledWith('profile-1', {
      childId: 'remote-1',
      currentMineScore: 260,
      streak: 3,
      updatedAt: '2099-01-01T00:00:05.000Z',
    });
    expect(localRepo.markSessionSynced).toHaveBeenCalledWith('sess-1', '2099-01-01T00:00:05.000Z');
    expect(claims.get('sess-1')?.xpGranted).toBe(20);
  });

  it('records an interrupted / off-slot / non-first session as plain history, never a claim', async () => {
    const localRepo = local({
      readUnsyncedSessions: jest.fn().mockResolvedValue([
        completedSession({ id: 'interrupted', status: 'interrupted', rewardMine: 0 }),
        completedSession({ id: 'off', period: 'off_slot', rewardMine: 0 }),
        completedSession({ id: 'dup', rewardMine: 0 }), // local said "not first"
      ]),
    });
    const cloudRepo = cloud();

    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');

    expect(cloudRepo.claimBrushingSlot).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSession).toHaveBeenCalledTimes(3);
    expect(cloudRepo.upsertSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dup', childId: 'remote-1' }),
    );
    expect(localRepo.markSessionSynced).toHaveBeenCalledTimes(3);
  });
});

describe('ChildDataSyncUseCases — evaluation flush', () => {
  it('presents a missed slot to the atomic penalty and writes the authoritative result back', async () => {
    const evaluation: Omit<CloudSlotEvaluation, 'childId'> = {
      localDayKey: '2026-08-23',
      period: 'evening',
      outcome: 'missed',
      penaltyMine: -10,
      appliedPenaltyMine: -10,
      evaluatedAt: '2026-08-24T00:00:00.000Z',
    };
    const localRepo = local({ readUnsyncedEvaluations: jest.fn().mockResolvedValue([evaluation]) });
    const cloudRepo = cloud();

    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');

    expect(cloudRepo.applySlotPenalty).toHaveBeenCalledWith({
      childId: 'remote-1',
      localDayKey: '2026-08-23',
      period: 'evening',
      evaluatedAt: '2026-08-24T00:00:00.000Z',
    });
    expect(localRepo.writeRecoveredProgress).toHaveBeenCalledWith('profile-1', {
      childId: 'remote-1',
      currentMineScore: 230,
      streak: 3,
      updatedAt: '2099-01-01T00:00:05.000Z',
    });
    expect(localRepo.markEvaluationSynced).toHaveBeenCalledWith(
      'profile-1',
      '2026-08-23',
      'evening',
      '2099-01-01T00:00:05.000Z',
    );
  });

  it('records a completed-outcome evaluation as plain history', async () => {
    const localRepo = local({
      readUnsyncedEvaluations: jest.fn().mockResolvedValue([
        {
          localDayKey: '2026-08-23',
          period: 'morning',
          outcome: 'completed',
          penaltyMine: 0,
          appliedPenaltyMine: 0,
          evaluatedAt: '2026-08-24T00:00:00.000Z',
        },
      ]),
    });
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushChild('profile-1');
    expect(cloudRepo.applySlotPenalty).not.toHaveBeenCalled();
    expect(cloudRepo.upsertSlotEvaluation).toHaveBeenCalledTimes(1);
  });
});

describe('ChildDataSyncUseCases — progress recovery is PULL-ONLY and cloud-authoritative', () => {
  const cloudRow: CloudChildProgress = {
    childId: 'remote-1',
    currentMineScore: 640,
    streak: 5,
    updatedAt: '2099-01-01T00:00:09.000Z',
  };

  it('overwrites the local cache with the cloud row unconditionally — even a dirtier / newer local value', async () => {
    const localRepo = local({
      // A stale device whose local row is defaulted / dirty / "newer": IRRELEVANT now.
      readProgressSnapshot: jest.fn().mockResolvedValue({
        currentMineScore: 0,
        streak: 0,
        syncedAt: null,
        syncedScore: null,
        syncedStreak: null,
      }),
    });
    await new ChildDataSyncUseCases(
      localRepo,
      cloud({ listOwnedProgress: jest.fn().mockResolvedValue([cloudRow]) }),
    ).recoverProgress();
    expect(localRepo.writeRecoveredProgress).toHaveBeenCalledWith('profile-1', cloudRow);
  });

  it('hydrates when there is no local progress row', async () => {
    const localRepo = local({ readProgressSnapshot: jest.fn().mockResolvedValue(null) });
    await new ChildDataSyncUseCases(
      localRepo,
      cloud({ listOwnedProgress: jest.fn().mockResolvedValue([cloudRow]) }),
    ).recoverProgress();
    expect(localRepo.writeRecoveredProgress).toHaveBeenCalledWith('profile-1', cloudRow);
  });

  it('skips a cloud row with no matching local profile', async () => {
    const localRepo = local({ findProfileByRemoteChildId: jest.fn().mockResolvedValue(null) });
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
        .mockImplementation((id: string) =>
          Promise.resolve(id === 'remote-a' ? 'profile-a' : 'profile-b'),
        ),
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
  it('flushes every synced child through the per-slot claims', async () => {
    const localRepo = local({
      listSyncedProfileIds: jest.fn().mockResolvedValue(['profile-a', 'profile-b']),
      resolveRemoteChildId: jest.fn().mockResolvedValue('remote-x'),
      readUnsyncedSessions: jest.fn().mockResolvedValue([completedSession()]),
    });
    const cloudRepo = cloud();
    await new ChildDataSyncUseCases(localRepo, cloudRepo).pushAllPending();
    expect(cloudRepo.claimBrushingSlot).toHaveBeenCalledTimes(2);
  });
});
