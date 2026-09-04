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
  hasStoredVoiceProfile: jest.fn(),
  setBrushingVoiceProfile: jest.fn(),
  markVoiceProfileSynced: jest.fn(),
  readVoiceProfileSyncMeta: jest.fn(),
}));
jest.mock('@/features/reminders', () => ({
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

import { ensureChildDataRecovered, resetSessionSyncState } from '../services';

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
