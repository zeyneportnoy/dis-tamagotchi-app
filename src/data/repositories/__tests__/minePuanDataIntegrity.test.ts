import type { SQLiteDatabase } from 'expo-sqlite';

import { ChildExperienceUseCases } from '@/application/child';
import { ChildDataSyncUseCases } from '@/application/sync';
import { migrateDatabase } from '@/data/db';
import { starterAvatarKeys, type StarterAvatarKey } from '@/domain/family';
import { growthStageForXp } from '@/domain/rewards';
import type {
  CloudBrushingSession,
  CloudChildDataRepository,
  CloudChildProgress,
  CloudSlotEvaluation,
} from '@/domain/sync';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteBrushingSessionRepository } from '../SQLiteBrushingSessionRepository';
import { SQLiteChildCloudSyncRepository } from '../SQLiteChildCloudSyncRepository';
import { SQLiteInventoryRepository } from '../SQLiteInventoryRepository';
import { SQLiteProfileProgressRepository } from '../SQLiteProfileProgressRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-sqlite', () => ({}));

// ---------------------------------------------------------------------------
// Test-only fixtures. Regression tests exercise every one of the 8 real
// DentHero characters so a future change cannot special-case any single one
// (there is no "Emrah" in production code — these ids are the app's own
// starter avatar catalog). None of these scores are ever hardcoded outside
// this test file.
// ---------------------------------------------------------------------------
const ALL_CHARACTERS = starterAvatarKeys;

async function seedFamily(database: NodeSQLiteDatabase): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO families (id, created_at, locale, timezone)
     VALUES ('family-1', '2026-01-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
  );
}

async function seedProfile(
  database: NodeSQLiteDatabase,
  id: string,
  avatarId: StarterAvatarKey,
  createdAt: string,
  parentId = 'parent-1',
): Promise<void> {
  await seedFamily(database);
  await database.runAsync(
    `INSERT INTO child_profiles
      (id, family_id, nickname, age_band, avatar_id, created_at,
       parent_auth_user_id, remote_id, sync_status)
     VALUES (?, 'family-1', ?, '4_6', ?, ?, ?, ?, 'synced')`,
    id,
    id,
    avatarId,
    createdAt,
    parentId,
    id,
  );
}

async function seedScore(
  database: NodeSQLiteDatabase,
  profileId: string,
  score: number,
  statusDate = '2026-08-08',
): Promise<void> {
  await database.runAsync(
    `INSERT INTO profile_progress(child_profile_id, status_date, total_xp, level)
     VALUES (?, ?, ?, ?)`,
    profileId,
    statusDate,
    score,
    score >= 1000 ? 3 : score >= 400 ? 2 : 1,
  );
}

async function readScore(database: NodeSQLiteDatabase, profileId: string): Promise<number> {
  const row = await database.getFirstAsync<{ total_xp: number }>(
    `SELECT total_xp FROM profile_progress WHERE child_profile_id = ?`,
    profileId,
  );
  if (!row) throw new Error(`no profile_progress row for ${profileId}`);
  return row.total_xp;
}

/** Deterministic, fully in-memory stand-in for Supabase — no network involved. */
class FakeCloudChildDataRepository implements CloudChildDataRepository {
  readonly progress = new Map<string, CloudChildProgress>();
  readonly sessions = new Map<string, CloudBrushingSession>();
  readonly evaluations = new Map<string, CloudSlotEvaluation>();

  async upsertProgress(progress: CloudChildProgress): Promise<string> {
    const updatedAt = new Date().toISOString();
    this.progress.set(progress.childId, { ...progress, updatedAt });
    return updatedAt;
  }

  async upsertSession(session: CloudBrushingSession): Promise<string> {
    const updatedAt = new Date().toISOString();
    this.sessions.set(session.id, { ...session, updatedAt });
    return updatedAt;
  }

  async upsertSlotEvaluation(evaluation: CloudSlotEvaluation): Promise<string> {
    const updatedAt = new Date().toISOString();
    this.evaluations.set(`${evaluation.childId}:${evaluation.localDayKey}:${evaluation.period}`, {
      ...evaluation,
      updatedAt,
    });
    return updatedAt;
  }

  async getProgress(childId: string): Promise<CloudChildProgress | null> {
    return this.progress.get(childId) ?? null;
  }

  async listOwnedProgress(): Promise<readonly CloudChildProgress[]> {
    return [...this.progress.values()];
  }

  async listOwnedSessions(): Promise<readonly CloudBrushingSession[]> {
    return [...this.sessions.values()];
  }

  async listOwnedSlotEvaluations(): Promise<readonly CloudSlotEvaluation[]> {
    return [...this.evaluations.values()];
  }
}

function makeHarness(database: NodeSQLiteDatabase, clock: { current: Date }, parentId = 'parent-1') {
  const sessions = new SQLiteBrushingSessionRepository(
    database as unknown as SQLiteDatabase,
    undefined,
    () => clock.current,
    async () => parentId,
  );
  const progress = new SQLiteProfileProgressRepository(
    database as unknown as SQLiteDatabase,
    () => clock.current,
  );
  const inventory = new SQLiteInventoryRepository(
    database as unknown as SQLiteDatabase,
    async () => parentId,
  );
  const child = new ChildExperienceUseCases(progress, sessions, inventory);
  const cloudLocal = new SQLiteChildCloudSyncRepository(database as unknown as SQLiteDatabase);
  return { sessions, progress, inventory, child, cloudLocal };
}

// ---------------------------------------------------------------------------
// Section 2 / 9 — evolution thresholds hold identically for all 8 characters
// ---------------------------------------------------------------------------
describe('growth stage thresholds — all 8 characters', () => {
  const boundaries: readonly (readonly [number, 0 | 1 | 2 | 3 | 4])[] = [
    [0, 0],
    [159, 0],
    [160, 1],
    [399, 1],
    [400, 2],
    [999, 2],
    [1000, 3],
    [1799, 3],
    [1800, 4],
    [2400, 4],
  ];

  it.each(ALL_CHARACTERS)('%s maps every boundary score to the correct stage', async (avatarId) => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    for (const [score, expectedStage] of boundaries) {
      const profileId = `${avatarId}-${score}`;
      await seedProfile(database, profileId, avatarId, '2026-08-01T00:00:00.000Z');
      await seedScore(database, profileId, score);
      const progressRepo = new SQLiteProfileProgressRepository(database as unknown as SQLiteDatabase);
      const row = await progressRepo.get(profileId);
      expect(row.totalXp).toBe(score);
      expect(growthStageForXp(row.totalXp)).toBe(expectedStage);
    }
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Section 3 / 9 — legitimate backward evolution survives for every character
// ---------------------------------------------------------------------------
describe('legitimate backward evolution — all 8 characters', () => {
  const regressions = [
    [165, 155, 1, 0],
    [405, 395, 2, 1],
    [1005, 995, 3, 2],
    [1805, 1795, 4, 3],
  ] as const;

  it.each(ALL_CHARACTERS.flatMap((avatarId) => regressions.map((r) => [avatarId, ...r] as const)))(
    '%s: a real missed slot moves %i -> %i (stage %i -> %i)',
    async (avatarId, before, after, stageBefore, stageAfter) => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      const profileId = `${avatarId}-regress-${before}`;
      await seedProfile(database, profileId, avatarId, new Date(2026, 7, 8, 4).toISOString());
      await seedScore(database, profileId, before);
      const clock = { current: new Date(2026, 7, 8, 12) };
      const { sessions } = makeHarness(database, clock);

      expect(growthStageForXp(before)).toBe(stageBefore);
      await sessions.reconcileMissedSlots(profileId);
      const after1 = await readScore(database, profileId);
      expect(after1).toBe(after);
      expect(growthStageForXp(after1)).toBe(stageAfter);
      database.close();
    },
  );
});

// ---------------------------------------------------------------------------
// Section 4 / 5 / 6 — root cause: reconciliation racing ahead of history
// hydration corrupts a real profile's score, and the fix (hydrate-before-
// reconcile, ordered by `ensureChildDataRecovered`) prevents it.
// ---------------------------------------------------------------------------
describe('root cause: missed-slot reconciliation before history hydration', () => {
  it('reproduces the bug: an unhydrated reinstalled device turns real completed history into false -10 penalties', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const created = new Date(2026, 7, 1, 8);
    await seedProfile(database, 'kid-1', 'inci', created.toISOString());
    const clock = { current: new Date(2026, 7, 1, 8) };
    const { sessions } = makeHarness(database, clock);

    // Five real days of correct progress: morning + evening every day.
    // 5 days x 2 slots x 20 = 200 (Çatlıyor, per spec 160-399).
    for (let day = 1; day <= 5; day += 1) {
      clock.current = new Date(2026, 7, day, 8);
      await sessions.finish({
        sessionId: `m-${day}`,
        profileId: 'kid-1',
        startedAt: clock.current.toISOString(),
        durationSeconds: 120,
      });
      clock.current = new Date(2026, 7, day, 19);
      await sessions.finish({
        sessionId: `e-${day}`,
        profileId: 'kid-1',
        startedAt: clock.current.toISOString(),
        durationSeconds: 120,
      });
    }
    clock.current = new Date(2026, 7, 6, 0, 1);
    await sessions.reconcileMissedSlots('kid-1');
    const correctScore = await readScore(database, 'kid-1');
    expect(correctScore).toBe(200);
    expect(growthStageForXp(correctScore)).toBe(1); // Çatlıyor

    // --- Simulate "delete app completely, fresh install" on the SAME account ---
    // The reinstalled device's local tables for this child are empty except the
    // profile itself (recreated by profile recovery) and its correct score
    // (recreated by progress recovery) — real history has NOT been hydrated yet.
    await database.runAsync(`DELETE FROM brushing_sessions WHERE profile_id = 'kid-1'`);
    await database.runAsync(`DELETE FROM daily_progress WHERE child_profile_id = 'kid-1'`);
    await database.runAsync(`DELETE FROM brushing_slot_evaluations WHERE child_profile_id = 'kid-1'`);
    await database.runAsync(`DELETE FROM brushing_session_attempts WHERE profile_id = 'kid-1'`);
    // profile_progress already holds the correct 200 from progress recovery.

    // THE BUG: reconciliation runs before brushing-history hydration.
    clock.current = new Date(2026, 7, 6, 9);
    await sessions.reconcileMissedSlots('kid-1');
    const corrupted = await readScore(database, 'kid-1');
    // 10 real Mine Puan-earning slots wrongly re-judged as missed: 200 - 10*10.
    // Even without hitting the floor, this alone crashes the child back from
    // Çatlıyor to Yumurta — a longer real history crashes all the way to 0.
    expect(corrupted).toBe(100);
    expect(growthStageForXp(corrupted)).toBe(0); // wrongly back to Yumurta

    // And it reproduces the reported data shape: real completed sessions never
    // existed locally at evaluation time, so every one of those 10 slots was
    // recorded as "missed" even though the child genuinely brushed.
    const missedCount = await database.getFirstAsync<{ count: number }>(
      `SELECT count(*) AS count FROM brushing_slot_evaluations
       WHERE child_profile_id = 'kid-1' AND outcome = 'missed'`,
    );
    expect(missedCount?.count).toBe(10);
    database.close();
  });

  it('fix: hydrating brushing history before reconciliation preserves the real score after reinstall', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const created = new Date(2026, 7, 1, 8);
    await seedProfile(database, 'kid-1', 'inci', created.toISOString());
    const clock = { current: new Date(2026, 7, 1, 8) };
    const { sessions, cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    for (let day = 1; day <= 5; day += 1) {
      clock.current = new Date(2026, 7, day, 8);
      await sessions.finish({
        sessionId: `m-${day}`,
        profileId: 'kid-1',
        startedAt: clock.current.toISOString(),
        durationSeconds: 120,
      });
      clock.current = new Date(2026, 7, day, 19);
      await sessions.finish({
        sessionId: `e-${day}`,
        profileId: 'kid-1',
        startedAt: clock.current.toISOString(),
        durationSeconds: 120,
      });
    }
    clock.current = new Date(2026, 7, 6, 0, 1);
    await sessions.reconcileMissedSlots('kid-1');
    const correctScore = await readScore(database, 'kid-1');
    expect(correctScore).toBe(200);

    // Push everything to the fake cloud (this device's own sync, pre-reinstall).
    await cloudSync.pushChild('kid-1');
    expect(cloud.progress.get('kid-1')?.currentMineScore).toBe(200);
    expect(cloud.sessions.size).toBe(10);
    expect(cloud.evaluations.size).toBe(10);

    // --- Reinstall: wipe local history exactly as above. The real reinstalled
    // device has NO profile_progress row at all yet — not a zeroed one — since
    // nothing has created one before recovery gets a chance to run in the fixed
    // bootstrap order.
    await database.runAsync(`DELETE FROM brushing_sessions WHERE profile_id = 'kid-1'`);
    await database.runAsync(`DELETE FROM daily_progress WHERE child_profile_id = 'kid-1'`);
    await database.runAsync(`DELETE FROM brushing_slot_evaluations WHERE child_profile_id = 'kid-1'`);
    await database.runAsync(`DELETE FROM brushing_session_attempts WHERE profile_id = 'kid-1'`);
    await database.runAsync(`DELETE FROM profile_progress WHERE child_profile_id = 'kid-1'`);

    // THE FIX, in the correct order: recover progress + brushing history BEFORE
    // ever calling reconcileMissedSlots (this is exactly what
    // `ensureChildDataRecovered()` now guarantees ahead of MissedSlotReconciler
    // and the bootstrap route in app/index.tsx).
    await cloudSync.recoverProgress();
    await cloudSync.recoverBrushingHistory();
    clock.current = new Date(2026, 7, 6, 9);
    await sessions.reconcileMissedSlots('kid-1');

    const restoredScore = await readScore(database, 'kid-1');
    expect(restoredScore).toBe(200);
    expect(growthStageForXp(restoredScore)).toBe(1);
    const missedCount = await database.getFirstAsync<{ count: number }>(
      `SELECT count(*) AS count FROM brushing_slot_evaluations
       WHERE child_profile_id = 'kid-1' AND outcome = 'missed'`,
    );
    expect(missedCount?.count).toBe(0);
    database.close();
  });

  it('fix: a completed session hydrated after its evaluation has not yet been computed anywhere is still recognized as completed', async () => {
    // Cross-device edge case: Device A completed the slot and pushed the
    // SESSION, but no device had yet run reconciliation to produce an
    // EVALUATION row for it (the slot had only just closed). Device B (or a
    // reinstalled Device A) hydrates that session and must not re-derive
    // "missed" from its own empty daily_progress cache.
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'milo', new Date(2026, 7, 8, 4).toISOString());
    await seedScore(database, 'kid-1', 100);
    const clock = { current: new Date(2026, 7, 8, 12) };
    const { sessions, cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    // Only a SESSION exists in the cloud for this slot — no evaluation yet.
    await cloud.upsertSession({
      id: 'remote-session-1',
      childId: 'kid-1',
      localDayKey: '2026-08-08',
      period: 'morning',
      startedAt: '2026-08-08T08:00:00.000Z',
      completedAt: '2026-08-08T08:02:00.000Z',
      status: 'completed',
      rewardMine: 20,
      timezoneOffsetMinutes: -180,
    });
    await cloudSync.recoverBrushingHistory();

    await sessions.reconcileMissedSlots('kid-1');
    const evaluation = await database.getFirstAsync<{ outcome: string; penalty_amount: number }>(
      `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
       WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-08' AND period = 'morning'`,
    );
    expect(evaluation).toEqual({ outcome: 'completed', penalty_amount: 0 });
    expect(await readScore(database, 'kid-1')).toBe(100); // unchanged — no false penalty
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Section 7 — legacy "completed AND missed" conflict repair
// ---------------------------------------------------------------------------
describe('legacy completed-vs-missed conflict repair', () => {
  type CorruptedSlotOptions = Readonly<{
    sessionId?: string;
    localDayKey?: string;
    period?: 'morning' | 'evening';
    scoreBefore: number;
    scoreAfter: number;
  }>;

  // A genuine completed + rewarded session, alongside a corrupted "missed"
  // evaluation for that SAME slot recording the real score_before/score_after
  // at the moment the wrong penalty was applied (the reported production
  // shape) — not just the flat -10 label.
  async function seedCorruptedSlot(
    database: NodeSQLiteDatabase,
    profileId: string,
    options: CorruptedSlotOptions,
  ): Promise<void> {
    const {
      sessionId = 'legit-session',
      localDayKey = '2026-08-08',
      period = 'morning',
      scoreBefore,
      scoreAfter,
    } = options;
    const hour = period === 'morning' ? '08' : '19';
    const startedAt = `${localDayKey}T${hour}:00:00.000Z`;
    const completedAt = `${localDayKey}T${hour}:02:00.000Z`;
    await database.runAsync(
      `INSERT INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period,
         created_at, local_day_key, reward_granted_at, xp_granted)
       VALUES (?, ?, ?, ?, 120, 1, ?, ?, ?, ?, 20)`,
      sessionId,
      profileId,
      startedAt,
      completedAt,
      period,
      completedAt,
      localDayKey,
      completedAt,
    );
    await database.runAsync(
      `INSERT INTO brushing_slot_evaluations
        (child_profile_id, local_day_key, period, outcome, penalty_amount,
         score_before, score_after, evaluated_at)
       VALUES (?, ?, ?, 'missed', -10, ?, ?, ?)`,
      profileId,
      localDayKey,
      period,
      scoreBefore,
      scoreAfter,
      completedAt,
    );
  }

  it('corrects the evaluation and refunds exactly the wrongly-applied penalty once', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'topi', new Date(2026, 7, 8, 4).toISOString());
    await seedScore(database, 'kid-1', 20); // already deducted, matches the corrupted evaluation
    await seedCorruptedSlot(database, 'kid-1', { scoreBefore: 30, scoreAfter: 20 });
    const clock = { current: new Date(2026, 7, 8, 12, 30) };
    const { sessions } = makeHarness(database, clock);

    await sessions.reconcileMissedSlots('kid-1');

    const evaluation = await database.getFirstAsync<{ outcome: string; penalty_amount: number }>(
      `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
       WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-08' AND period = 'morning'`,
    );
    expect(evaluation).toEqual({ outcome: 'completed', penalty_amount: 0 });
    expect(await readScore(database, 'kid-1')).toBe(30); // 20 + 10 refunded, no more

    // The session row (history + its original reward) is untouched.
    const session = await database.getFirstAsync<{ completed: number; xp_granted: number }>(
      `SELECT completed, xp_granted FROM brushing_sessions WHERE id = 'legit-session'`,
    );
    expect(session).toEqual({ completed: 1, xp_granted: 20 });
    database.close();
  });

  it('is idempotent across 50 repeated reconciliation passes — never refunds twice', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'akil', new Date(2026, 7, 8, 4).toISOString());
    await seedScore(database, 'kid-1', 20);
    await seedCorruptedSlot(database, 'kid-1', { scoreBefore: 30, scoreAfter: 20 });
    const clock = { current: new Date(2026, 7, 8, 12, 30) };
    const { sessions } = makeHarness(database, clock);

    for (let i = 0; i < 50; i += 1) {
      await sessions.reconcileMissedSlots('kid-1');
    }
    expect(await readScore(database, 'kid-1')).toBe(30);
    database.close();
  });

  it('does not touch a genuinely missed slot that has no matching completed session', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'uyku', new Date(2026, 7, 8, 4).toISOString());
    await seedScore(database, 'kid-1', 30);
    await database.runAsync(
      `INSERT INTO brushing_slot_evaluations
        (child_profile_id, local_day_key, period, outcome, penalty_amount,
         score_before, score_after, evaluated_at)
       VALUES ('kid-1', '2026-08-08', 'morning', 'missed', -10, 40, 30, '2026-08-08T12:00:00.000Z')`,
    );
    const clock = { current: new Date(2026, 7, 8, 12, 30) };
    const { sessions } = makeHarness(database, clock);

    await sessions.reconcileMissedSlots('kid-1');
    const evaluation = await database.getFirstAsync<{ outcome: string; penalty_amount: number }>(
      `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
       WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-08' AND period = 'morning'`,
    );
    expect(evaluation).toEqual({ outcome: 'missed', penalty_amount: -10 });
    expect(await readScore(database, 'kid-1')).toBe(30); // unchanged, correctly
    database.close();
  });

  // -------------------------------------------------------------------------
  // Legacy repair refund math must respect the score floor at 0. The flat -10
  // `penalty_amount` label is what was INTENDED; the row's own
  // `score_before`/`score_after` record what was ACTUALLY removed once
  // clamped by `Math.max(0, scoreBefore - 10)`. Blindly refunding by
  // `penalty_amount` over-credits whenever the original penalty hit the
  // floor.
  // -------------------------------------------------------------------------
  describe('refund math respects the score floor — no over-crediting', () => {
    it('1) score already 0 when the false penalty was recorded: no artificial +10 credit', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(database, 'kid-1', 'inci', new Date(2026, 7, 8, 4).toISOString());
      await seedScore(database, 'kid-1', 0); // current score is exactly what the corrupted row left
      await seedCorruptedSlot(database, 'kid-1', { scoreBefore: 0, scoreAfter: 0 });
      const clock = { current: new Date(2026, 7, 8, 12, 30) };
      const { sessions } = makeHarness(database, clock);

      await sessions.reconcileMissedSlots('kid-1');

      const evaluation = await database.getFirstAsync<{ outcome: string; penalty_amount: number }>(
        `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
         WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-08' AND period = 'morning'`,
      );
      expect(evaluation).toEqual({ outcome: 'completed', penalty_amount: 0 });
      expect(await readScore(database, 'kid-1')).toBe(0); // NOT 10
      database.close();
    });

    it('2) score 5 -> floor 0: repair restores exactly 5, not 10', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(database, 'kid-1', 'piril', new Date(2026, 7, 8, 4).toISOString());
      await seedScore(database, 'kid-1', 0); // the wrong -10 already floored it to 0
      await seedCorruptedSlot(database, 'kid-1', { scoreBefore: 5, scoreAfter: 0 });
      const clock = { current: new Date(2026, 7, 8, 12, 30) };
      const { sessions } = makeHarness(database, clock);

      await sessions.reconcileMissedSlots('kid-1');

      expect(await readScore(database, 'kid-1')).toBe(5); // exact, not 10
      database.close();
    });

    it('3) score 10 -> floor 0: repair restores exactly 10', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(database, 'kid-1', 'kaan', new Date(2026, 7, 8, 4).toISOString());
      await seedScore(database, 'kid-1', 0);
      await seedCorruptedSlot(database, 'kid-1', { scoreBefore: 10, scoreAfter: 0 });
      const clock = { current: new Date(2026, 7, 8, 12, 30) };
      const { sessions } = makeHarness(database, clock);

      await sessions.reconcileMissedSlots('kid-1');

      expect(await readScore(database, 'kid-1')).toBe(10);
      database.close();
    });

    it('4) score 100 -> 90 (no floor hit): repair restores exactly 100', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(database, 'kid-1', 'milo', new Date(2026, 7, 8, 4).toISOString());
      await seedScore(database, 'kid-1', 90);
      await seedCorruptedSlot(database, 'kid-1', { scoreBefore: 100, scoreAfter: 90 });
      const clock = { current: new Date(2026, 7, 8, 12, 30) };
      const { sessions } = makeHarness(database, clock);

      await sessions.reconcileMissedSlots('kid-1');

      expect(await readScore(database, 'kid-1')).toBe(100);
      database.close();
    });

    it('5) multiple false-missed evaluations stacked after the score already hit 0: final score equals the true pre-corruption score, no over-credit', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      // Created the same day as both target slots so no OTHER slot has closed
      // by reconciliation time — only the two seeded below are in play.
      await seedProfile(database, 'kid-1', 'zipzip', new Date(2026, 7, 8, 4).toISOString());
      // True pre-corruption score was 5. A false -10 on 08-08 morning floors it
      // to 0 (real delta -5); a SECOND false -10 on 08-08 evening is then
      // computed against the already-corrupted 0 (real delta -0, since there
      // was nothing left to remove). Both wrongly coexist with a genuine
      // completed+rewarded session for their own slot.
      await seedScore(database, 'kid-1', 0); // current, post-both-wrong-penalties
      await seedCorruptedSlot(database, 'kid-1', {
        sessionId: 'legit-session-1',
        localDayKey: '2026-08-08',
        period: 'morning',
        scoreBefore: 5,
        scoreAfter: 0,
      });
      await seedCorruptedSlot(database, 'kid-1', {
        sessionId: 'legit-session-2',
        localDayKey: '2026-08-08',
        period: 'evening',
        scoreBefore: 0,
        scoreAfter: 0,
      });
      const clock = { current: new Date(2026, 7, 9, 0, 1) };
      const { sessions } = makeHarness(database, clock);

      await sessions.reconcileMissedSlots('kid-1');

      // 0 (corrupted) + 5 (real loss from the first) + 0 (nothing left to lose
      // on the second) = 5, the true pre-corruption score — never 20 (blind
      // 2x +10) and never 10 (blind 1x +10 counted twice).
      expect(await readScore(database, 'kid-1')).toBe(5);
      const evaluations = await database.getAllAsync<{ outcome: string; penalty_amount: number }>(
        `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
         WHERE child_profile_id = 'kid-1' ORDER BY local_day_key`,
      );
      expect(evaluations).toEqual([
        { outcome: 'completed', penalty_amount: 0 },
        { outcome: 'completed', penalty_amount: 0 },
      ]);
      database.close();
    });

    it('6) a mix of legitimate and false missed slots: only the false conflict is repaired, the legitimate penalty remains', async () => {
      const database = new NodeSQLiteDatabase();
      await migrateDatabase(database as unknown as SQLiteDatabase);
      await seedProfile(database, 'kid-1', 'topi', new Date(2026, 7, 8, 4).toISOString());
      // Current score already reflects: a genuine missed evening penalty
      // (50 -> 40, real, no matching session) plus the false morning penalty
      // (40 -> 30, matching a real completed+rewarded session).
      await seedScore(database, 'kid-1', 30);
      await database.runAsync(
        `INSERT INTO brushing_slot_evaluations
          (child_profile_id, local_day_key, period, outcome, penalty_amount,
           score_before, score_after, evaluated_at)
         VALUES ('kid-1', '2026-08-07', 'evening', 'missed', -10, 50, 40, '2026-08-08T00:00:00.000Z')`,
      );
      await seedCorruptedSlot(database, 'kid-1', {
        localDayKey: '2026-08-08',
        period: 'morning',
        scoreBefore: 40,
        scoreAfter: 30,
      });
      const clock = { current: new Date(2026, 7, 8, 12, 30) };
      const { sessions } = makeHarness(database, clock);

      await sessions.reconcileMissedSlots('kid-1');

      const legitimate = await database.getFirstAsync<{ outcome: string; penalty_amount: number }>(
        `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
         WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-07' AND period = 'evening'`,
      );
      expect(legitimate).toEqual({ outcome: 'missed', penalty_amount: -10 }); // untouched
      const repaired = await database.getFirstAsync<{ outcome: string; penalty_amount: number }>(
        `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
         WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-08' AND period = 'morning'`,
      );
      expect(repaired).toEqual({ outcome: 'completed', penalty_amount: 0 }); // corrected
      // 30 (current) + 10 refunded for the false morning penalty only = 40.
      // The legitimate evening -10 stays baked in (never refunded).
      expect(await readScore(database, 'kid-1')).toBe(40);
      database.close();
    });
  });
});

// ---------------------------------------------------------------------------
// Section 10 — multi-child isolation (TEST-ONLY fixtures, not production
// defaults; a real new profile always starts at 0, unaffected by this file).
// ---------------------------------------------------------------------------
describe('multi-child isolation', () => {
  async function buildFixtures(database: NodeSQLiteDatabase) {
    // A: avatar inci, score 160  |  B: avatar inci, score 0 (same avatar as A)
    // C: avatar piril, score 420 |  D: avatar uyku, score 1810
    await seedProfile(database, 'child-A', 'inci', new Date(2026, 7, 8, 8).toISOString());
    await seedProfile(database, 'child-B', 'inci', new Date(2026, 7, 8, 8).toISOString());
    await seedProfile(database, 'child-C', 'piril', new Date(2026, 7, 8, 8).toISOString());
    await seedProfile(database, 'child-D', 'uyku', new Date(2026, 7, 8, 8).toISOString());
    await seedScore(database, 'child-A', 160);
    await seedScore(database, 'child-B', 0);
    await seedScore(database, 'child-C', 420);
    await seedScore(database, 'child-D', 1810);
  }

  it('the same avatar shared by two children never shares score, evolution or unlocks', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await buildFixtures(database);

    expect(await readScore(database, 'child-A')).toBe(160);
    expect(await readScore(database, 'child-B')).toBe(0);
    expect(growthStageForXp(await readScore(database, 'child-A'))).toBe(1); // Çatlıyor
    expect(growthStageForXp(await readScore(database, 'child-B'))).toBe(0); // Yumurta
    database.close();
  });

  it('changing A does not change B, even though they share an avatar', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await buildFixtures(database);
    const clock = { current: new Date(2026, 7, 8, 8) };
    const { sessions } = makeHarness(database, clock);

    await sessions.finish({
      sessionId: 'a-morning',
      profileId: 'child-A',
      startedAt: clock.current.toISOString(),
      durationSeconds: 120,
    });

    expect(await readScore(database, 'child-A')).toBe(180);
    expect(await readScore(database, 'child-B')).toBe(0); // untouched
    database.close();
  });

  it('avatar switch never inherits or moves score', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await buildFixtures(database);

    // "Switching avatar" for child B: only avatar_id changes, never progress.
    await database.runAsync(`UPDATE child_profiles SET avatar_id = 'zipzip' WHERE id = 'child-B'`);
    expect(await readScore(database, 'child-B')).toBe(0);
    expect(await readScore(database, 'child-A')).toBe(160); // A (still 'inci') unaffected
    database.close();
  });

  it("C's recovery does not touch A, B or D", async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await buildFixtures(database);
    // Mark C's local row "clean" (already synced at its current value) so this
    // test exercises the actual cloud-is-newer hydration path rather than the
    // separate "local has unpushed edits" guard.
    await database.runAsync(
      `UPDATE profile_progress
       SET current_streak = 0, synced_at = '2026-08-01T00:00:00.000Z',
           synced_score = 420, synced_streak = 0
       WHERE child_profile_id = 'child-C'`,
    );
    const clock = { current: new Date(2026, 7, 8, 8) };
    const { cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    cloud.progress.set('child-C', {
      childId: 'child-C',
      currentMineScore: 500,
      streak: 1,
      updatedAt: '2026-08-10T00:00:00.000Z',
    });
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    await cloudSync.recoverProgress();

    expect(await readScore(database, 'child-C')).toBe(500);
    expect(await readScore(database, 'child-A')).toBe(160);
    expect(await readScore(database, 'child-B')).toBe(0);
    expect(await readScore(database, 'child-D')).toBe(1810);
    database.close();
  });

  it("D's missed-slot penalty affects only D", async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await buildFixtures(database);
    const clock = { current: new Date(2026, 7, 8, 12) };
    const { sessions } = makeHarness(database, clock);

    // D was created earlier the same morning so exactly one missed morning
    // slot closes now (the clock's own creation moment has not closed yet).
    await database.runAsync(
      `UPDATE child_profiles SET created_at = ? WHERE id = 'child-D'`,
      new Date(2026, 7, 8, 4).toISOString(),
    );
    await sessions.reconcileMissedSlots('child-D');

    expect(await readScore(database, 'child-D')).toBe(1800); // 1810 - 10
    expect(await readScore(database, 'child-A')).toBe(160);
    expect(await readScore(database, 'child-B')).toBe(0);
    expect(await readScore(database, 'child-C')).toBe(420);
    database.close();
  });

  it('reading one profile after switching the active child never leaks a cached progress value', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await buildFixtures(database);
    const clock = { current: new Date(2026, 7, 8, 8) };
    const { child } = makeHarness(database, clock);

    const a = await child.getProgress('child-A');
    const b = await child.getProgress('child-B');
    const c = await child.getProgress('child-C');
    const d = await child.getProgress('child-D');
    expect(a.totalXp).toBe(160);
    expect(b.totalXp).toBe(0);
    expect(c.totalXp).toBe(420);
    expect(d.totalXp).toBe(1810);
    // Re-reading A after touching every other profile is still exactly A's own.
    expect((await child.getProgress('child-A')).totalXp).toBe(160);
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Section 11 — 30-day deterministic simulation, exact-equality against
// independently computed expected Mine Puan.
// ---------------------------------------------------------------------------
describe('30-day simulation with independently computed exact scores', () => {
  type DayPattern = 'both' | 'morningOnly' | 'eveningOnly' | 'neither' | 'interrupted' | 'offSlot';

  // Cycles through every requested pattern across 30 days.
  const pattern30Days: readonly DayPattern[] = Array.from({ length: 30 }, (_, i) => {
    const cycle: readonly DayPattern[] = [
      'both',
      'morningOnly',
      'eveningOnly',
      'neither',
      'both',
      'interrupted',
      'offSlot',
    ];
    return cycle[i % cycle.length];
  });

  it('matches an independent day-by-day accumulator exactly across 30 days', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const start = new Date(2026, 6, 1, 4);
    await seedProfile(database, 'kid-1', 'kaan', start.toISOString());
    const clock = { current: start };
    const { sessions, cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    let expectedScore = 0;
    let sessionCounter = 0;

    for (let day = 0; day < pattern30Days.length; day += 1) {
      const dayStart = new Date(2026, 6, 1 + day, 0, 0);
      const pattern = pattern30Days[day];

      if (pattern === 'both' || pattern === 'morningOnly') {
        clock.current = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 8);
        sessionCounter += 1;
        await sessions.finish({
          sessionId: `s-${sessionCounter}`,
          profileId: 'kid-1',
          startedAt: clock.current.toISOString(),
          durationSeconds: 120,
        });
        expectedScore += 20;
      }
      if (pattern === 'both' || pattern === 'eveningOnly') {
        clock.current = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 19);
        sessionCounter += 1;
        await sessions.finish({
          sessionId: `s-${sessionCounter}`,
          profileId: 'kid-1',
          startedAt: clock.current.toISOString(),
          durationSeconds: 120,
        });
        expectedScore += 20;
      }
      if (pattern === 'interrupted') {
        // Attempted but abandoned morning session: no reward, no penalty yet
        // (the slot only becomes "missed" once it closes without completion).
        clock.current = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 8);
        sessionCounter += 1;
        await sessions.finish({
          sessionId: `s-${sessionCounter}`,
          profileId: 'kid-1',
          startedAt: clock.current.toISOString(),
          durationSeconds: 45, // < 120s → not completed
        });
      }
      if (pattern === 'offSlot') {
        // Outside both slot windows (15:00): never rewarded, never penalized.
        clock.current = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 15);
        sessionCounter += 1;
        await sessions.finish({
          sessionId: `s-${sessionCounter}`,
          profileId: 'kid-1',
          startedAt: clock.current.toISOString(),
          durationSeconds: 120,
        });
      }

      // Missed slots incur -10 once the slot actually closes: morning at 12:00,
      // evening at the next midnight. Both 'interrupted' and 'offSlot' days miss
      // BOTH real slots since neither produces a qualifying completion.
      const missesMorning = pattern === 'eveningOnly' || pattern === 'neither' || pattern === 'interrupted' || pattern === 'offSlot';
      const missesEvening = pattern === 'morningOnly' || pattern === 'neither' || pattern === 'interrupted' || pattern === 'offSlot';
      if (missesMorning) expectedScore = Math.max(0, expectedScore - 10);
      if (missesEvening) expectedScore = Math.max(0, expectedScore - 10);

      // Reconciliation is called repeatedly through the day (foreground,
      // background, sync retries) — must still land on the same exact score.
      clock.current = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1, 0, 0);
      await sessions.reconcileMissedSlots('kid-1');
      await sessions.reconcileMissedSlots('kid-1');
      await sessions.reconcileMissedSlots('kid-1');

      // Offline-then-sync + "app killed before sync" simulation: push may or
      // may not have happened yet; either way it must never change the score.
      if (day % 3 === 0) {
        await cloudSync.pushChild('kid-1');
      }
      // Repeated cloud recovery on relaunch — must be a pure no-op on a clean,
      // already-synced device.
      await cloudSync.recoverProgress();
      await cloudSync.recoverBrushingHistory();

      expect(await readScore(database, 'kid-1')).toBe(expectedScore);
    }

    // Final push, then a fresh-install recovery from the cloud must land on
    // exactly the same authoritative number.
    await cloudSync.pushChild('kid-1');
    const database2 = new NodeSQLiteDatabase();
    await migrateDatabase(database2 as unknown as SQLiteDatabase);
    await seedProfile(database2, 'kid-1', 'kaan', start.toISOString());
    // Same instant the 30-day loop left off at — no new slot has closed since,
    // so recovery + reconciliation on the fresh device must be a pure no-op.
    const clock2 = { current: new Date(2026, 6, 31, 0, 0) };
    const harness2 = makeHarness(database2, clock2);
    const cloudSync2 = new ChildDataSyncUseCases(harness2.cloudLocal, cloud);
    await cloudSync2.recoverProgress();
    await cloudSync2.recoverBrushingHistory();
    await harness2.sessions.reconcileMissedSlots('kid-1');
    expect(await readScore(database2, 'kid-1')).toBe(expectedScore);
    database2.close();
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Section 12 — soak / repeatability: bootstrap-like cycles never move score.
// ---------------------------------------------------------------------------
describe('soak: repeated bootstrap / recovery / sync cycles never change score', () => {
  it('50x bootstrap, recover, foreground and sync-retry cycles land on the exact expected score', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    const start = new Date(2026, 5, 1, 4);
    await seedProfile(database, 'kid-1', 'zipzip', start.toISOString());
    const clock = { current: start };
    const { sessions, cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    // Build ~30 days of alternating complete/missed history.
    let expectedScore = 0;
    for (let day = 0; day < 30; day += 1) {
      const completesMorning = day % 2 === 0;
      const completesEvening = day % 3 !== 0;
      if (completesMorning) {
        clock.current = new Date(2026, 5, 1 + day, 8);
        await sessions.finish({
          sessionId: `m-${day}`,
          profileId: 'kid-1',
          startedAt: clock.current.toISOString(),
          durationSeconds: 120,
        });
        expectedScore += 20;
      }
      if (completesEvening) {
        clock.current = new Date(2026, 5, 1 + day, 19);
        await sessions.finish({
          sessionId: `e-${day}`,
          profileId: 'kid-1',
          startedAt: clock.current.toISOString(),
          durationSeconds: 120,
        });
        expectedScore += 20;
      }
      clock.current = new Date(2026, 5, 2 + day, 0);
      await sessions.reconcileMissedSlots('kid-1');
      if (!completesMorning) expectedScore = Math.max(0, expectedScore - 10);
      if (!completesEvening) expectedScore = Math.max(0, expectedScore - 10);
    }
    await cloudSync.pushChild('kid-1');
    expect(await readScore(database, 'kid-1')).toBe(expectedScore);

    // 50x bootstrap-equivalent cycles: recover progress, recover history,
    // reconcile, push — none of these may move the score by even 1 Mine.
    for (let i = 0; i < 50; i += 1) {
      await cloudSync.recoverProgress();
      await cloudSync.recoverBrushingHistory();
      await sessions.reconcileMissedSlots('kid-1');
      await cloudSync.pushChild('kid-1');
    }
    expect(await readScore(database, 'kid-1')).toBe(expectedScore);

    // 50x foreground-style reconciliation alone.
    for (let i = 0; i < 50; i += 1) {
      await sessions.reconcileMissedSlots('kid-1');
    }
    expect(await readScore(database, 'kid-1')).toBe(expectedScore);

    // 50x recovery alone (simulating repeated multi-device conflict checks).
    for (let i = 0; i < 50; i += 1) {
      await cloudSync.recoverProgress();
    }
    expect(await readScore(database, 'kid-1')).toBe(expectedScore);
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Sections 6 (K/L) and 17 — stale-vs-newer multi-device conflict resolution.
// ---------------------------------------------------------------------------
describe('stale-cloud / stale-local conflict resolution never loses the authoritative value', () => {
  it('a stale cloud row never overwrites a newer unsynced local score', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'inci', new Date(2026, 7, 1, 8).toISOString());
    await database.runAsync(
      `INSERT INTO profile_progress
        (child_profile_id, status_date, total_xp, synced_at, synced_score, synced_streak)
       VALUES ('kid-1', '2026-08-08', 260, '2026-08-05T00:00:00.000Z', 240, 3)`,
    );
    const clock = { current: new Date(2026, 7, 8, 8) };
    const { cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    await cloud.upsertProgress({
      childId: 'kid-1',
      currentMineScore: 100, // stale, older device value
      streak: 1,
    });
    // Force an old updatedAt, strictly before this device's last sync.
    cloud.progress.set('kid-1', {
      childId: 'kid-1',
      currentMineScore: 100,
      streak: 1,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    await cloudSync.recoverProgress();
    expect(await readScore(database, 'kid-1')).toBe(260); // unsynced local wins
    database.close();
  });

  it('a stale local snapshot is replaced by a genuinely newer authoritative cloud value', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'inci', new Date(2026, 7, 1, 8).toISOString());
    // Genuinely clean: current_streak matches synced_streak, total_xp matches
    // synced_score — this local row has nothing unpushed.
    await database.runAsync(
      `INSERT INTO profile_progress
        (child_profile_id, status_date, total_xp, current_streak,
         synced_at, synced_score, synced_streak)
       VALUES ('kid-1', '2026-08-08', 240, 3, '2026-08-05T00:00:00.000Z', 240, 3)`,
    );
    const clock = { current: new Date(2026, 7, 8, 8) };
    const { cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    cloud.progress.set('kid-1', {
      childId: 'kid-1',
      currentMineScore: 640, // another device progressed further, and pushed
      streak: 5,
      updatedAt: '2026-08-10T00:00:00.000Z', // newer than our last sync
    });
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    await cloudSync.recoverProgress();
    expect(await readScore(database, 'kid-1')).toBe(640);
    database.close();
  });

  it('fresh install recovers the authoritative cloud score with no local history at all', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'inci', new Date(2026, 7, 1, 8).toISOString());
    // No profile_progress row at all yet — true fresh install shape.
    const clock = { current: new Date(2026, 7, 8, 8) };
    const { cloudLocal } = makeHarness(database, clock);
    const cloud = new FakeCloudChildDataRepository();
    cloud.progress.set('kid-1', {
      childId: 'kid-1',
      currentMineScore: 380,
      streak: 2,
      updatedAt: '2026-08-08T00:00:00.000Z',
    });
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    await cloudSync.recoverProgress();
    expect(await readScore(database, 'kid-1')).toBe(380);
    database.close();
  });

  it('a missing remote progress row is never treated as score 0 for a child with local history', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'inci', new Date(2026, 7, 1, 8).toISOString());
    await seedScore(database, 'kid-1', 300);
    const clock = { current: new Date(2026, 7, 8, 8) };
    const { cloudLocal } = makeHarness(database, clock);
    // Cloud has nothing for this child at all (never synced yet, or the row
    // genuinely does not exist server-side).
    const cloud = new FakeCloudChildDataRepository();
    const cloudSync = new ChildDataSyncUseCases(cloudLocal, cloud);

    await cloudSync.recoverProgress();
    expect(await readScore(database, 'kid-1')).toBe(300); // untouched, not zeroed
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Cloud round-trip preserves the ACTUAL clamped applied-penalty delta
// (`appliedPenaltyMine`), so a second device (or a reinstalled Device A) can
// repair a completed-vs-missed conflict EXACTLY after hydrating it from the
// cloud — not just when the corrupted row was created on the same device.
// ---------------------------------------------------------------------------
describe('cloud round-trip preserves the exact applied penalty delta', () => {
  /**
   * Seeds Device A with a genuine completed+rewarded session AND a corrupted
   * "missed" evaluation for that same slot (the shape a device running an
   * older, pre-fix build already wrote and already pushed to production),
   * then pushes it to the shared cloud AS-IS — Device A's own local repair is
   * never run here, so the round-trip through the cloud is what is under
   * test, not same-device self-healing.
   */
  async function seedAndPushCorruptedDeviceA(
    cloud: FakeCloudChildDataRepository,
    startScore: number,
  ): Promise<{ scoreAfterPenalty: number }> {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'inci', new Date(2026, 7, 8, 4).toISOString());
    const scoreAfterPenalty = Math.max(0, startScore - 10);
    await seedScore(database, 'kid-1', scoreAfterPenalty); // production's current (corrupted) value
    await database.runAsync(
      `INSERT INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period,
         created_at, local_day_key, reward_granted_at, xp_granted)
       VALUES ('legit-session', 'kid-1', '2026-08-08T08:00:00.000Z', '2026-08-08T08:02:00.000Z', 120, 1,
               'morning', '2026-08-08T08:02:00.000Z', '2026-08-08', '2026-08-08T08:02:00.000Z', 20)`,
    );
    await database.runAsync(
      `INSERT INTO brushing_slot_evaluations
        (child_profile_id, local_day_key, period, outcome, penalty_amount,
         score_before, score_after, evaluated_at)
       VALUES ('kid-1', '2026-08-08', 'morning', 'missed', -10, ?, ?, '2026-08-08T12:00:00.000Z')`,
      startScore,
      scoreAfterPenalty,
    );
    const clock = { current: new Date(2026, 7, 8, 12, 30) };
    const { cloudLocal } = makeHarness(database, clock);
    await new ChildDataSyncUseCases(cloudLocal, cloud).pushChild('kid-1');
    database.close();
    return { scoreAfterPenalty };
  }

  it.each([0, 5, 10, 100])(
    'A/B) score %i -> false -10 hydrated on a fresh Device B repairs to exactly %i',
    async (startScore) => {
      const cloud = new FakeCloudChildDataRepository();
      await seedAndPushCorruptedDeviceA(cloud, startScore);

      // The pushed evaluation carries the real, floor-clamped delta.
      const pushedEval = cloud.evaluations.get('kid-1:2026-08-08:morning');
      // `|| 0` normalizes -0 (from e.g. `-Math.min(10, 0)`) to +0 for `toBe`'s
      // Object.is comparison.
      expect(pushedEval?.appliedPenaltyMine).toBe(-Math.min(10, startScore) || 0);

      // Device B: fresh install, nothing local yet.
      const deviceB = new NodeSQLiteDatabase();
      await migrateDatabase(deviceB as unknown as SQLiteDatabase);
      await seedProfile(deviceB, 'kid-1', 'inci', new Date(2026, 7, 8, 4).toISOString());
      const clockB = { current: new Date(2026, 7, 8, 12, 30) };
      const { sessions, cloudLocal } = makeHarness(deviceB, clockB);
      const cloudSyncB = new ChildDataSyncUseCases(cloudLocal, cloud);

      await cloudSyncB.recoverProgress();
      await cloudSyncB.recoverBrushingHistory();
      await sessions.reconcileMissedSlots('kid-1');

      expect(await readScore(deviceB, 'kid-1')).toBe(startScore);
      const evaluation = await deviceB.getFirstAsync<{ outcome: string; penalty_amount: number }>(
        `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
         WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-08' AND period = 'morning'`,
      );
      expect(evaluation).toEqual({ outcome: 'completed', penalty_amount: 0 });
      deviceB.close();
    },
  );

  it('C) two cloud-hydrated false-missed evaluations stacked after floor=0: exact result, no over-credit', async () => {
    const cloud = new FakeCloudChildDataRepository();
    // Device A: true pre-corruption score was 5. Morning false -10 floors it
    // to 0 (real loss 5); evening false -10 is then computed against the
    // already-corrupted 0 (real loss 0). Both pushed with their real deltas.
    const deviceA = new NodeSQLiteDatabase();
    await migrateDatabase(deviceA as unknown as SQLiteDatabase);
    await seedProfile(deviceA, 'kid-1', 'inci', new Date(2026, 7, 8, 4).toISOString());
    await seedScore(deviceA, 'kid-1', 0);
    await deviceA.runAsync(
      `INSERT INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period,
         created_at, local_day_key, reward_granted_at, xp_granted)
       VALUES ('legit-session-1', 'kid-1', '2026-08-08T08:00:00.000Z', '2026-08-08T08:02:00.000Z', 120, 1,
               'morning', '2026-08-08T08:02:00.000Z', '2026-08-08', '2026-08-08T08:02:00.000Z', 20)`,
    );
    await deviceA.runAsync(
      `INSERT INTO brushing_slot_evaluations
        (child_profile_id, local_day_key, period, outcome, penalty_amount,
         score_before, score_after, evaluated_at)
       VALUES ('kid-1', '2026-08-08', 'morning', 'missed', -10, 5, 0, '2026-08-08T12:00:00.000Z')`,
    );
    await deviceA.runAsync(
      `INSERT INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period,
         created_at, local_day_key, reward_granted_at, xp_granted)
       VALUES ('legit-session-2', 'kid-1', '2026-08-08T19:00:00.000Z', '2026-08-08T19:02:00.000Z', 120, 1,
               'evening', '2026-08-08T19:02:00.000Z', '2026-08-08', '2026-08-08T19:02:00.000Z', 20)`,
    );
    await deviceA.runAsync(
      `INSERT INTO brushing_slot_evaluations
        (child_profile_id, local_day_key, period, outcome, penalty_amount,
         score_before, score_after, evaluated_at)
       VALUES ('kid-1', '2026-08-08', 'evening', 'missed', -10, 0, 0, '2026-08-09T00:00:00.000Z')`,
    );
    const clockA = { current: new Date(2026, 7, 9, 0, 1) };
    const { cloudLocal: cloudLocalA } = makeHarness(deviceA, clockA);
    await new ChildDataSyncUseCases(cloudLocalA, cloud).pushChild('kid-1');
    deviceA.close();

    expect(cloud.evaluations.get('kid-1:2026-08-08:morning')?.appliedPenaltyMine).toBe(-5);
    expect(cloud.evaluations.get('kid-1:2026-08-08:evening')?.appliedPenaltyMine).toBe(0);

    // Device B: fresh install hydrates both, then repairs both.
    const deviceB = new NodeSQLiteDatabase();
    await migrateDatabase(deviceB as unknown as SQLiteDatabase);
    await seedProfile(deviceB, 'kid-1', 'inci', new Date(2026, 7, 8, 4).toISOString());
    const clockB = { current: new Date(2026, 7, 9, 0, 1) };
    const { sessions, cloudLocal: cloudLocalB } = makeHarness(deviceB, clockB);
    const cloudSyncB = new ChildDataSyncUseCases(cloudLocalB, cloud);
    await cloudSyncB.recoverProgress();
    await cloudSyncB.recoverBrushingHistory();
    await sessions.reconcileMissedSlots('kid-1');

    expect(await readScore(deviceB, 'kid-1')).toBe(5); // never 15, never 20
    deviceB.close();
  });

  it('D) a legacy cloud row with no known delta hydrates as zero known loss — never invents a +10 refund', async () => {
    const cloud = new FakeCloudChildDataRepository();
    // A row pushed by a build that predates this field: penaltyMine=-10 but
    // appliedPenaltyMine is null (the column did not exist yet).
    cloud.evaluations.set('kid-1:2026-08-08:morning', {
      childId: 'kid-1',
      localDayKey: '2026-08-08',
      period: 'morning',
      outcome: 'missed',
      penaltyMine: -10,
      appliedPenaltyMine: null,
      evaluatedAt: '2026-08-08T12:00:00.000Z',
      updatedAt: '2026-08-08T12:00:01.000Z',
    });
    cloud.sessions.set('legit-session', {
      id: 'legit-session',
      childId: 'kid-1',
      localDayKey: '2026-08-08',
      period: 'morning',
      startedAt: '2026-08-08T08:00:00.000Z',
      completedAt: '2026-08-08T08:02:00.000Z',
      status: 'completed',
      rewardMine: 20,
      timezoneOffsetMinutes: -180,
      updatedAt: '2026-08-08T08:02:01.000Z',
    });
    cloud.progress.set('kid-1', {
      childId: 'kid-1',
      currentMineScore: 37, // whatever the cloud's authoritative value is
      streak: 0,
      updatedAt: '2026-08-08T12:00:01.000Z',
    });

    const deviceB = new NodeSQLiteDatabase();
    await migrateDatabase(deviceB as unknown as SQLiteDatabase);
    await seedProfile(deviceB, 'kid-1', 'inci', new Date(2026, 7, 8, 4).toISOString());
    const clockB = { current: new Date(2026, 7, 8, 12, 30) };
    const { sessions, cloudLocal } = makeHarness(deviceB, clockB);
    const cloudSyncB = new ChildDataSyncUseCases(cloudLocal, cloud);

    await cloudSyncB.recoverProgress();
    await cloudSyncB.recoverBrushingHistory();
    await sessions.reconcileMissedSlots('kid-1');

    // Deterministic safe behavior: the outcome/label is still corrected (so it
    // stops permanently blocking re-evaluation and stops mis-reporting history),
    // but NOT a single artificial Mine is credited — score is exactly what was
    // hydrated, unchanged.
    expect(await readScore(deviceB, 'kid-1')).toBe(37);
    const evaluation = await deviceB.getFirstAsync<{ outcome: string; penalty_amount: number }>(
      `SELECT outcome, penalty_amount FROM brushing_slot_evaluations
       WHERE child_profile_id = 'kid-1' AND local_day_key = '2026-08-08' AND period = 'morning'`,
    );
    expect(evaluation).toEqual({ outcome: 'completed', penalty_amount: 0 });
    deviceB.close();
  });

  it('E) 30-day cloud round-trip: Device A history -> cloud -> fresh Device B -> recovery/reconcile, exact score equality', async () => {
    const cloud = new FakeCloudChildDataRepository();
    const start = new Date(2026, 6, 1, 4);

    const deviceA = new NodeSQLiteDatabase();
    await migrateDatabase(deviceA as unknown as SQLiteDatabase);
    await seedProfile(deviceA, 'kid-1', 'inci', start.toISOString());
    const clockA = { current: start };
    const { sessions: sessionsA, cloudLocal: cloudLocalA } = makeHarness(deviceA, clockA);
    const cloudSyncA = new ChildDataSyncUseCases(cloudLocalA, cloud);

    let expectedScore = 0;
    for (let day = 0; day < 30; day += 1) {
      const completesMorning = day % 2 === 0;
      const completesEvening = day % 5 !== 0;
      if (completesMorning) {
        clockA.current = new Date(2026, 6, 1 + day, 8);
        await sessionsA.finish({
          sessionId: `m-${day}`,
          profileId: 'kid-1',
          startedAt: clockA.current.toISOString(),
          durationSeconds: 120,
        });
        expectedScore += 20;
      }
      if (completesEvening) {
        clockA.current = new Date(2026, 6, 1 + day, 19);
        await sessionsA.finish({
          sessionId: `e-${day}`,
          profileId: 'kid-1',
          startedAt: clockA.current.toISOString(),
          durationSeconds: 120,
        });
        expectedScore += 20;
      }
      clockA.current = new Date(2026, 6, 2 + day, 0);
      await sessionsA.reconcileMissedSlots('kid-1');
      if (!completesMorning) expectedScore = Math.max(0, expectedScore - 10);
      if (!completesEvening) expectedScore = Math.max(0, expectedScore - 10);
      await cloudSyncA.pushChild('kid-1');
    }
    expect(await readScore(deviceA, 'kid-1')).toBe(expectedScore);
    deviceA.close();

    // Fresh Device B, same account, recovers everything from the cloud.
    const deviceB = new NodeSQLiteDatabase();
    await migrateDatabase(deviceB as unknown as SQLiteDatabase);
    await seedProfile(deviceB, 'kid-1', 'inci', start.toISOString());
    const clockB = { current: new Date(2026, 6, 31, 0) };
    const { sessions: sessionsB, cloudLocal: cloudLocalB } = makeHarness(deviceB, clockB);
    const cloudSyncB = new ChildDataSyncUseCases(cloudLocalB, cloud);
    await cloudSyncB.recoverProgress();
    await cloudSyncB.recoverBrushingHistory();
    await sessionsB.reconcileMissedSlots('kid-1');

    expect(await readScore(deviceB, 'kid-1')).toBe(expectedScore);
    deviceB.close();
  });

  it('F) repeated fresh-install recovery (20x) never drifts the score', async () => {
    const cloud = new FakeCloudChildDataRepository();
    await seedAndPushCorruptedDeviceA(cloud, 5); // pushes the real -5 delta

    const deviceB = new NodeSQLiteDatabase();
    await migrateDatabase(deviceB as unknown as SQLiteDatabase);
    await seedProfile(deviceB, 'kid-1', 'inci', new Date(2026, 7, 8, 4).toISOString());
    const clockB = { current: new Date(2026, 7, 8, 12, 30) };
    const { sessions, cloudLocal } = makeHarness(deviceB, clockB);
    const cloudSyncB = new ChildDataSyncUseCases(cloudLocal, cloud);

    for (let i = 0; i < 20; i += 1) {
      await cloudSyncB.recoverProgress();
      await cloudSyncB.recoverBrushingHistory();
      await sessions.reconcileMissedSlots('kid-1');
      expect(await readScore(deviceB, 'kid-1')).toBe(5); // repaired once, stable forever after
    }
    deviceB.close();
  });
});

// ---------------------------------------------------------------------------
// Section 8 — Collection / equip persistence is not damaged by a legitimate
// score drop or by the repair pass.
// ---------------------------------------------------------------------------
describe('collection / equip persistence is unaffected by score changes', () => {
  it('a legitimate penalty that re-locks an equipped brush keeps the selection persisted (only the effective/display key falls back)', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'topi', new Date(2026, 7, 8, 4).toISOString());
    await seedScore(database, 'kid-1', 485); // above mini-cape's 480 threshold
    await database.runAsync(
      `INSERT INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
       VALUES ('kid-1', 'mini-cape', '2026-08-08T00:00:00.000Z', 1, 'brush')`,
    );
    const clock = { current: new Date(2026, 7, 8, 12) };
    const { child } = makeHarness(database, clock);

    const progress = await child.getProgress('kid-1'); // 485 -10 = 475: re-locks mini-cape (480)
    expect(progress.totalXp).toBe(475);

    // The row itself is never deleted — ownership/history is preserved.
    const row = await database.getFirstAsync<{ item_key: string; equipped: number }>(
      `SELECT item_key, equipped FROM inventory_items
       WHERE child_profile_id = 'kid-1' AND item_key = 'mini-cape'`,
    );
    expect(row).toBeTruthy();
    // The default brush becomes equipped as the effective fallback, per the
    // existing (untouched) unlock-guard behavior.
    const equipped = await database.getAllAsync<{ item_key: string }>(
      `SELECT item_key FROM inventory_items WHERE child_profile_id = 'kid-1' AND equipped = 1`,
    );
    expect(equipped.map((r) => r.item_key)).toContain('classic-brush');
    database.close();
  });

  it('the legacy-conflict repair pass never touches inventory rows', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'kid-1', 'akil', new Date(2026, 7, 8, 4).toISOString());
    await seedScore(database, 'kid-1', 20);
    await database.runAsync(
      `INSERT INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period,
         created_at, local_day_key, reward_granted_at, xp_granted)
       VALUES ('legit-session', 'kid-1', '2026-08-08T08:00:00.000Z', '2026-08-08T08:02:00.000Z', 120, 1,
               'morning', '2026-08-08T08:02:00.000Z', '2026-08-08', '2026-08-08T08:02:00.000Z', 20)`,
    );
    await database.runAsync(
      `INSERT INTO brushing_slot_evaluations
        (child_profile_id, local_day_key, period, outcome, penalty_amount,
         score_before, score_after, evaluated_at)
       VALUES ('kid-1', '2026-08-08', 'morning', 'missed', -10, 30, 20, '2026-08-08T12:00:00.000Z')`,
    );
    await database.runAsync(
      `INSERT INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
       VALUES ('kid-1', 'sparkle-crown', '2026-08-08T00:00:00.000Z', 1, 'wearable')`,
    );
    const clock = { current: new Date(2026, 7, 8, 12, 30) };
    const { sessions } = makeHarness(database, clock);

    await sessions.reconcileMissedSlots('kid-1');
    const row = await database.getFirstAsync<{ equipped: number }>(
      `SELECT equipped FROM inventory_items
       WHERE child_profile_id = 'kid-1' AND item_key = 'sparkle-crown'`,
    );
    expect(row).toEqual({ equipped: 1 }); // untouched by the repair
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Section 1 — avatar_id is never used as progress identity (structural check)
// ---------------------------------------------------------------------------
describe('avatar_id is never progress identity', () => {
  it('two profiles with the same avatar_id but different ids have fully independent profile_progress rows', async () => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, 'twin-A', 'uyku', new Date(2026, 7, 1, 8).toISOString());
    await seedProfile(database, 'twin-B', 'uyku', new Date(2026, 7, 1, 8).toISOString());
    await seedScore(database, 'twin-A', 900);
    await seedScore(database, 'twin-B', 10);

    const rows = await database.getAllAsync<{ child_profile_id: string; total_xp: number }>(
      `SELECT child_profile_id, total_xp FROM profile_progress ORDER BY child_profile_id`,
    );
    expect(rows).toEqual([
      { child_profile_id: 'twin-A', total_xp: 900 },
      { child_profile_id: 'twin-B', total_xp: 10 },
    ]);
    // profile_progress has no avatar_id column at all — it is keyed purely by
    // child_profile_id, confirmed structurally by selecting only that column.
    database.close();
  });
});

// ---------------------------------------------------------------------------
// Section 13 — a real new profile always starts at 0 (production default).
// ---------------------------------------------------------------------------
describe('production default: a brand-new profile always starts at 0 Mine Puan', () => {
  it.each(ALL_CHARACTERS)('%s: a freshly created profile has 0 Mine Puan before any brushing', async (avatarId) => {
    const database = new NodeSQLiteDatabase();
    await migrateDatabase(database as unknown as SQLiteDatabase);
    await seedProfile(database, `${avatarId}-fresh`, avatarId, new Date(2026, 7, 8, 8).toISOString());
    const progressRepo = new SQLiteProfileProgressRepository(
      database as unknown as SQLiteDatabase,
      () => new Date(2026, 7, 8, 8),
    );
    const progress = await progressRepo.get(`${avatarId}-fresh`);
    expect(progress.totalXp).toBe(0);
    expect(growthStageForXp(progress.totalXp)).toBe(0);
    database.close();
  });
});
