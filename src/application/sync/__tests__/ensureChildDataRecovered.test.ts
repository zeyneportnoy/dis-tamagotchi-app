/**
 * Unit test for the memoization contract `ensureChildDataRecovered()` relies
 * on: recovery must run at most once per signed-in session, in the fixed
 * order (progress, then brushing history), and every caller — the cold/warm
 * bootstrap in app/index.tsx and MissedSlotReconciler in app/_layout.tsx —
 * must observe the SAME in-flight/resolved promise instead of racing
 * independent copies of the same recovery work. See SQLiteBrushingSessionRepository
 * and minePuanDataIntegrity.test.ts for the end-to-end proof of why the
 * ordering itself matters.
 */
const mockRecoverProgress = jest.fn().mockResolvedValue(undefined);
const mockRecoverBrushingHistory = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/application/auth', () => ({ getParentAuthUseCases: jest.fn(() => undefined) }));
jest.mock('@/data/auth', () => ({ getSupabaseClient: jest.fn(() => ({})) }));
jest.mock('@/data/db', () => ({ getDatabase: jest.fn().mockResolvedValue({}) }));
jest.mock('@/data/repositories', () => ({
  SQLiteChildCloudSyncRepository: jest.fn(),
  SQLiteChildPreferenceSyncRepository: jest.fn(),
  SQLiteProfileSyncRepository: jest.fn(),
  SupabaseChildDataRepository: jest.fn(),
  SupabaseChildPreferencesRepository: jest.fn(),
  SupabaseChildProfileRepository: jest.fn(),
}));
jest.mock('@/features/brushing', () => ({
  getBrushingVoiceProfile: jest.fn(),
  getNicknamePersonalizationEnabled: jest.fn(),
  hasStoredNicknamePersonalization: jest.fn(),
  hasStoredVoiceProfile: jest.fn(),
  markNicknamePersonalizationSynced: jest.fn(),
  markVoiceProfileSynced: jest.fn(),
  readNicknamePersonalizationSyncMeta: jest.fn(),
  readVoiceProfileSyncMeta: jest.fn(),
  setBrushingVoiceProfile: jest.fn(),
  setNicknamePersonalizationEnabled: jest.fn(),
}));
jest.mock('@/features/reminders', () => ({
  dentistReminderService: { ensureScheduledForProfile: jest.fn() },
  dentistVisitService: { applyRecovered: jest.fn() },
  reminderSettingsService: { get: jest.fn(), hasStoredSettings: jest.fn() },
  syncGroupedBrushingReminders: jest.fn(),
}));
jest.mock('../ChildDataSyncUseCases', () => ({
  ChildDataSyncUseCases: jest.fn().mockImplementation(() => ({
    recoverProgress: mockRecoverProgress,
    recoverBrushingHistory: mockRecoverBrushingHistory,
    pushChild: jest.fn(),
    pushAllPending: jest.fn(),
  })),
}));

import {
  ensureChildDataRecovered,
  refreshChildCloudData,
  resetSessionSyncState,
} from '../services';

describe('ensureChildDataRecovered', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionSyncState();
  });

  it('recovers progress before brushing history, exactly once, even when called concurrently', async () => {
    const callOrder: string[] = [];
    mockRecoverProgress.mockImplementation(async () => {
      callOrder.push('progress');
    });
    mockRecoverBrushingHistory.mockImplementation(async () => {
      callOrder.push('history');
    });

    await Promise.all([
      ensureChildDataRecovered(),
      ensureChildDataRecovered(),
      ensureChildDataRecovered(),
    ]);

    expect(callOrder).toEqual(['progress', 'history']);
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);
    expect(mockRecoverBrushingHistory).toHaveBeenCalledTimes(1);
  });

  it('does not re-run recovery on a later call within the same session', async () => {
    await ensureChildDataRecovered();
    await ensureChildDataRecovered();
    await ensureChildDataRecovered();

    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);
    expect(mockRecoverBrushingHistory).toHaveBeenCalledTimes(1);
  });

  it('re-runs recovery for a new session after resetSessionSyncState (logout/login)', async () => {
    await ensureChildDataRecovered();
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);

    resetSessionSyncState();
    await ensureChildDataRecovered();

    expect(mockRecoverProgress).toHaveBeenCalledTimes(2);
    expect(mockRecoverBrushingHistory).toHaveBeenCalledTimes(2);
  });
});

describe('refreshChildCloudData — already-open device re-pull', () => {
  let nowMs = 1_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionSyncState();
    nowMs = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore();
  });

  it('awaits the one-time recovery gate first, then re-pulls progress before history', async () => {
    const order: string[] = [];
    mockRecoverProgress.mockImplementation(async () => {
      order.push('progress');
    });
    mockRecoverBrushingHistory.mockImplementation(async () => {
      order.push('history');
    });

    await refreshChildCloudData({ force: true });

    // One pass for the recovery gate, one for the forced refresh — always
    // progress before history.
    expect(order).toEqual(['progress', 'history', 'progress', 'history']);
  });

  it('the first getProgress-style call right after recovery is throttled (no immediate re-pull)', async () => {
    await ensureChildDataRecovered();
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);

    await refreshChildCloudData(); // within the throttle window of the recovery
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);
  });

  it('re-pulls once the throttle interval has elapsed', async () => {
    await ensureChildDataRecovered();
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);

    nowMs += 9_000;
    await refreshChildCloudData();
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1); // still throttled

    nowMs += 2_000; // now > 10s since the recovery
    await refreshChildCloudData();
    expect(mockRecoverProgress).toHaveBeenCalledTimes(2); // pulled
  });

  it('force bypasses the throttle but never the ordering gate', async () => {
    await ensureChildDataRecovered();
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);

    await refreshChildCloudData({ force: true });
    expect(mockRecoverProgress).toHaveBeenCalledTimes(2);
    await refreshChildCloudData({ force: true });
    expect(mockRecoverProgress).toHaveBeenCalledTimes(3);
  });

  it('coalesces concurrent callers onto a single in-flight pull', async () => {
    await ensureChildDataRecovered();
    mockRecoverProgress.mockClear();
    mockRecoverBrushingHistory.mockClear();
    mockRecoverProgress.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 10)),
    );

    await Promise.all([
      refreshChildCloudData({ force: true }),
      refreshChildCloudData({ force: true }),
      refreshChildCloudData({ force: true }),
    ]);

    // Three concurrent callers, exactly one underlying pull.
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);
    expect(mockRecoverBrushingHistory).toHaveBeenCalledTimes(1);
  });

  it('resetSessionSyncState clears the refresh throttle so the next session re-pulls', async () => {
    await ensureChildDataRecovered();
    await refreshChildCloudData(); // throttled
    expect(mockRecoverProgress).toHaveBeenCalledTimes(1);

    resetSessionSyncState();
    await refreshChildCloudData({ force: true }); // new session: gate + refresh
    expect(mockRecoverProgress).toHaveBeenCalledTimes(3);
  });
});
