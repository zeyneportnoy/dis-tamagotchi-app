/**
 * Server-authoritative Mine Puan — a PROFILE-AGNOSTIC structural invariant.
 *
 * The acceptance criterion for the "a stale / freshly-started device zeroed
 * several children's cloud score" incident is STRUCTURAL:
 *
 *   A STALE LOCAL 0 MUST BE INCAPABLE OF OVERWRITING A VALID CLOUD 160.
 *
 * The client no longer has ANY method that writes an absolute
 * `current_mine_score` / `streak`. Score changes go only through the atomic,
 * idempotent per-slot operations `claimBrushingSlot` / `applySlotPenalty`,
 * which the server owns and which RETURN the new authoritative values. This
 * suite models those operations exactly (`FakeAuthoritativeCloud`) and drives
 * every real client sync path — startup / recovery / foreground / profile
 * switch / getProgress / pending flush — for many profile shapes.
 *
 * Nothing is keyed to a name, id, date or score: ids are generated, shapes /
 * slots are parameter matrices.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { ChildDataSyncUseCases } from '@/application/sync/ChildDataSyncUseCases';
import { migrateDatabase } from '@/data/db';
import { deriveStreak, growthStageForXp } from '@/domain/rewards';
import type {
  AuthoritativeProgress,
  BrushingSlotClaim,
  CloudBrushingSession,
  CloudChildDataRepository,
  CloudChildProgress,
  CloudSlotEvaluation,
  SlotPenaltyClaim,
} from '@/domain/sync';
import { NodeSQLiteDatabase } from '@/test/NodeSQLiteDatabase';

import { SQLiteBrushingSessionRepository } from '../SQLiteBrushingSessionRepository';
import { SQLiteChildCloudSyncRepository } from '../SQLiteChildCloudSyncRepository';
import { SQLiteProfileProgressRepository } from '../SQLiteProfileProgressRepository';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));
jest.mock('expo-sqlite', () => ({}));

const asDb = (database: NodeSQLiteDatabase): SQLiteDatabase =>
  database as unknown as SQLiteDatabase;

// -------------------------------------------------------------------------
// Faithful in-memory model of the `claim_brushing_slot` / `apply_slot_penalty`
// Postgres RPCs from migration m10. Same idempotency + additivity + streak
// recompute. It exposes NO way to set an absolute score from outside a claim.
// -------------------------------------------------------------------------
type ProgressState = { currentMineScore: number; streak: number; updatedAt: string };

class FakeAuthoritativeCloud implements CloudChildDataRepository {
  private readonly progress = new Map<string, ProgressState>();
  private readonly sessions = new Map<string, CloudBrushingSession>();
  private readonly rewardedSlots = new Set<string>();
  private readonly evaluations = new Map<string, CloudSlotEvaluation>();
  private seq = 0;

  private stamp(): string {
    this.seq += 1;
    return new Date(Date.UTC(2099, 0, 1) + this.seq * 1000).toISOString();
  }

  /** TEST-ONLY: prime a child's authoritative row, as if an earlier device wrote it. */
  seedProgress(childId: string, currentMineScore: number, streak: number): void {
    this.progress.set(childId, { currentMineScore, streak, updatedAt: this.stamp() });
  }

  /** TEST-ONLY: prime a canonical completed session (so streak recompute is realistic). */
  seedSession(childId: string, localDayKey: string, period: 'morning' | 'evening'): void {
    const id = `seed-${childId}-${localDayKey}-${period}`;
    this.sessions.set(id, {
      id,
      childId,
      localDayKey,
      period,
      startedAt: `${localDayKey}T00:00:00.000Z`,
      completedAt: `${localDayKey}T00:02:00.000Z`,
      status: 'completed',
      rewardMine: 20,
      timezoneOffsetMinutes: 0,
      updatedAt: this.stamp(),
    });
    this.rewardedSlots.add(`${childId}:${localDayKey}:${period}`);
  }

  cloudScore(childId: string): number | undefined {
    return this.progress.get(childId)?.currentMineScore;
  }

  cloudStreak(childId: string): number | undefined {
    return this.progress.get(childId)?.streak;
  }

  rewardedSlotCount(childId: string, localDayKey: string, period: string): number {
    return [...this.sessions.values()].filter(
      (s) =>
        s.childId === childId &&
        s.localDayKey === localDayKey &&
        s.period === period &&
        s.rewardMine === 20,
    ).length;
  }

  private fullDayKeys(childId: string, asOf: string): string[] {
    const byDay = new Map<string, Set<string>>();
    for (const s of this.sessions.values()) {
      if (
        s.childId === childId &&
        s.status === 'completed' &&
        s.period !== 'off_slot' &&
        s.localDayKey <= asOf
      ) {
        const set = byDay.get(s.localDayKey) ?? new Set<string>();
        set.add(s.period);
        byDay.set(s.localDayKey, set);
      }
    }
    return [...byDay.entries()].filter(([, p]) => p.size === 2).map(([k]) => k);
  }

  private ensureRow(childId: string): ProgressState {
    // Mirrors `insert ... on conflict (child_id) do nothing`: creates at 0 only
    // when absent; NEVER overwrites an existing authoritative value.
    let row = this.progress.get(childId);
    if (!row) {
      row = { currentMineScore: 0, streak: 0, updatedAt: this.stamp() };
      this.progress.set(childId, row);
    }
    return row;
  }

  private slotCompletion(childId: string, localDayKey: string) {
    const done = (period: 'morning' | 'evening'): boolean =>
      [...this.sessions.values()].some(
        (s) =>
          s.childId === childId &&
          s.localDayKey === localDayKey &&
          s.period === period &&
          s.status === 'completed',
      );
    return { morningCompleted: done('morning'), eveningCompleted: done('evening') };
  }

  async claimBrushingSlot(claim: BrushingSlotClaim): Promise<AuthoritativeProgress> {
    const slotKey = `${claim.childId}:${claim.localDayKey}:${claim.period}`;
    if (!this.sessions.has(claim.sessionId)) {
      this.sessions.set(claim.sessionId, {
        id: claim.sessionId,
        childId: claim.childId,
        localDayKey: claim.localDayKey,
        period: claim.period,
        startedAt: claim.startedAt,
        completedAt: claim.completedAt,
        status: 'completed',
        rewardMine: 0,
        timezoneOffsetMinutes: claim.timezoneOffsetMinutes,
        updatedAt: this.stamp(),
      });
    }
    const won = !this.rewardedSlots.has(slotKey);
    if (won) {
      this.rewardedSlots.add(slotKey);
      const session = this.sessions.get(claim.sessionId);
      if (session) this.sessions.set(claim.sessionId, { ...session, rewardMine: 20 });
    }
    const row = this.ensureRow(claim.childId);
    if (won) row.currentMineScore += 20;
    row.streak = deriveStreak(
      this.fullDayKeys(claim.childId, claim.localDayKey),
      claim.localDayKey,
    );
    row.updatedAt = this.stamp();
    return {
      childId: claim.childId,
      xpGranted: won ? 20 : 0,
      penaltyApplied: 0,
      currentMineScore: row.currentMineScore,
      streak: row.streak,
      ...this.slotCompletion(claim.childId, claim.localDayKey),
      alreadyResolved: !won,
      updatedAt: row.updatedAt,
    };
  }

  async applySlotPenalty(claim: SlotPenaltyClaim): Promise<AuthoritativeProgress> {
    const evalKey = `${claim.childId}:${claim.localDayKey}:${claim.period}`;
    const completed = [...this.sessions.values()].some(
      (s) =>
        s.childId === claim.childId &&
        s.localDayKey === claim.localDayKey &&
        s.period === claim.period &&
        s.status === 'completed',
    );
    const won = !this.evaluations.has(evalKey);
    if (won) {
      this.evaluations.set(evalKey, {
        childId: claim.childId,
        localDayKey: claim.localDayKey,
        period: claim.period,
        outcome: completed ? 'completed' : 'missed',
        penaltyMine: completed ? 0 : -10,
        appliedPenaltyMine: null,
        evaluatedAt: claim.evaluatedAt,
        updatedAt: this.stamp(),
      });
    }
    const row = this.ensureRow(claim.childId);
    let penalty = 0;
    if (won && !completed) {
      const before = row.currentMineScore;
      row.currentMineScore = Math.max(0, before - 10);
      penalty = row.currentMineScore - before;
    }
    row.streak = deriveStreak(
      this.fullDayKeys(claim.childId, claim.localDayKey),
      claim.localDayKey,
    );
    row.updatedAt = this.stamp();
    return {
      childId: claim.childId,
      xpGranted: 0,
      penaltyApplied: penalty,
      currentMineScore: row.currentMineScore,
      streak: row.streak,
      ...this.slotCompletion(claim.childId, claim.localDayKey),
      alreadyResolved: !won,
      updatedAt: row.updatedAt,
    };
  }

  async upsertSession(session: CloudBrushingSession): Promise<string> {
    const updatedAt = this.stamp();
    // History only — never carries a reward (the trigger forces reward_mine 0).
    this.sessions.set(session.id, { ...session, rewardMine: 0, updatedAt });
    return updatedAt;
  }

  async upsertSlotEvaluation(evaluation: CloudSlotEvaluation): Promise<string> {
    const updatedAt = this.stamp();
    this.evaluations.set(`${evaluation.childId}:${evaluation.localDayKey}:${evaluation.period}`, {
      ...evaluation,
      updatedAt,
    });
    return updatedAt;
  }

  async getProgress(childId: string): Promise<CloudChildProgress | null> {
    const row = this.progress.get(childId);
    return row ? { childId, ...row } : null;
  }

  async listOwnedProgress(): Promise<readonly CloudChildProgress[]> {
    return [...this.progress.entries()].map(([childId, row]) => ({ childId, ...row }));
  }

  async listOwnedSessions(): Promise<readonly CloudBrushingSession[]> {
    return [...this.sessions.values()];
  }

  async listOwnedSlotEvaluations(): Promise<readonly CloudSlotEvaluation[]> {
    return [...this.evaluations.values()];
  }
}

// --- generated identifiers -------------------------------------------------
let childSeq = 0;
const nextChildId = (): string => `child-${(childSeq += 1)}`;
let sessionSeq = 0;
const nextSessionId = (): string => `session-${(sessionSeq += 1)}`;

// --- SQLite device --------------------------------------------------------
type Ymd = readonly [number, number, number];
const pad = (n: number): string => String(n).padStart(2, '0');
const dayKeyOf = ([y, m, d]: Ymd): string => `${y}-${pad(m + 1)}-${pad(d)}`;
const at = ([y, m, d]: Ymd, hour: number, minute = 0): Date => new Date(y, m, d, hour, minute);

async function seedProfile(
  database: NodeSQLiteDatabase,
  id: string,
  createdAt: string,
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO families (id, created_at, locale, timezone)
     VALUES ('family-1', '2000-01-01T00:00:00.000Z', 'tr', 'Europe/Istanbul')`,
  );
  await database.runAsync(
    `INSERT INTO child_profiles
      (id, family_id, nickname, age_band, avatar_id, created_at, remote_id, parent_auth_user_id,
       sync_status, updated_at)
     VALUES (?, 'family-1', ?, '4_6', 'inci', ?, ?, 'parent-1', 'synced', ?)`,
    id,
    id,
    createdAt,
    id,
    createdAt,
  );
}

async function seedLocalProgress(
  database: NodeSQLiteDatabase,
  id: string,
  mine: number,
  statusDate: string,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO profile_progress (child_profile_id, status_date, total_xp, level)
     VALUES (?, ?, ?, ?)`,
    id,
    statusDate,
    mine,
    mine >= 1000 ? 3 : mine >= 400 ? 2 : 1,
  );
}

function makeDevice(
  database: NodeSQLiteDatabase,
  clock: { current: Date },
  cloud: FakeAuthoritativeCloud,
) {
  const sessions = new SQLiteBrushingSessionRepository(
    asDb(database),
    undefined,
    () => clock.current,
    async () => 'parent-1',
  );
  const progress = new SQLiteProfileProgressRepository(asDb(database), () => clock.current);
  const cloudLocal = new SQLiteChildCloudSyncRepository(asDb(database));
  const sync = new ChildDataSyncUseCases(cloudLocal, cloud);
  return { database, clock, sessions, progress, cloudLocal, sync };
}
type Device = ReturnType<typeof makeDevice>;

async function bootDevice(
  cloud: FakeAuthoritativeCloud,
  ids: readonly string[],
  ymd: Ymd,
): Promise<Device> {
  const database = new NodeSQLiteDatabase();
  await migrateDatabase(asDb(database));
  const createdAt = at([ymd[0], ymd[1], ymd[2] - 1], 12).toISOString();
  for (const id of ids) await seedProfile(database, id, createdAt);
  return makeDevice(database, { current: at(ymd, 12) }, cloud);
}

const localScore = async (device: Device, id: string): Promise<number> =>
  (await device.progress.get(id)).totalXp;
const localStreak = async (device: Device, id: string): Promise<number> =>
  (await device.progress.get(id)).currentStreak;

/** The local-optimistic `finish()` then the authoritative claim flush. */
async function completeSlot(
  device: Device,
  id: string,
  ymd: Ymd,
  slot: { period: 'morning' | 'evening'; hour: number },
  minute: number,
) {
  device.clock.current = at(ymd, slot.hour, minute);
  const local = await device.sessions.finish({
    sessionId: nextSessionId(),
    profileId: id,
    startedAt: device.clock.current.toISOString(),
    durationSeconds: 120,
  });
  // `pushChild` returns the authoritative result keyed by claimed session id.
  const claims = await device.sync.pushChild(id);
  const authoritative = claims.get(local.session.id) ?? null;
  return { local, authoritative, finalScore: await localScore(device, id) };
}

/** Run every real client sync path for one already-initialised device. */
async function runAllSyncPaths(device: Device, ids: readonly string[]): Promise<void> {
  await device.sync.recoverProgress(); //         startup / account recovery / foreground pull
  await device.sync.recoverBrushingHistory(); //  history hydration
  await device.sync.pushAllPending(); //          pending-sync flush (the path that caused the bug)
  for (const id of ids) {
    await device.progress.get(id); //             getProgress / profile switch
    await device.sync.pushChild(id); //           post-read flush
  }
}

const BASE: Ymd = [2026, 8, 7];

// =======================================================================
// STRUCTURAL — the client type has no absolute-score writer at all.
// =======================================================================
describe('structural: the client cannot express an absolute score', () => {
  it('CloudChildDataRepository exposes no upsertProgress / absolute-score write', () => {
    const cloud = new FakeAuthoritativeCloud();
    // @ts-expect-error — the method was removed from the interface entirely.
    expect(cloud.upsertProgress).toBeUndefined();
    // The only score-changing methods are additive, per-slot, idempotent.
    expect(typeof cloud.claimBrushingSlot).toBe('function');
    expect(typeof cloud.applySlotPenalty).toBe('function');
  });

  it('ChildDataSyncUseCases exposes no pushProgress', () => {
    // @ts-expect-error — deleted; only per-slot claim flushes remain.
    expect(new ChildDataSyncUseCases({} as never, {} as never).pushProgress).toBeUndefined();
  });
});

// =======================================================================
// REQ 6 — stale local 0 must be INCAPABLE of overwriting valid cloud 160.
// =======================================================================
describe('req 6 — a stale device never overwrites the authoritative score', () => {
  it('cloud stays 160 / streak 3 through startup, recovery, foreground, profile switch, getProgress and pending sync', async () => {
    const cloud = new FakeAuthoritativeCloud();
    const id = nextChildId();
    cloud.seedProgress(id, 160, 3);
    for (const day of [
      [2026, 8, 5],
      [2026, 8, 6],
      [2026, 8, 7],
    ] as const) {
      cloud.seedSession(id, dayKeyOf(day), 'morning');
      cloud.seedSession(id, dayKeyOf(day), 'evening');
    }

    // Device B: local row defaulted / stale at 0 (or missing entirely).
    const b = await bootDevice(cloud, [id], BASE);
    await seedLocalProgress(b.database, id, 0, dayKeyOf(BASE));
    expect(await localScore(b, id)).toBe(0);

    // Every production sync path, several times.
    for (let round = 0; round < 3; round += 1) {
      await runAllSyncPaths(b, [id]);
      expect(cloud.cloudScore(id)).toBe(160); // cloud UNTOUCHED at every stage
      expect(cloud.cloudStreak(id)).toBe(3);
    }

    // Device B converged to the authoritative value.
    expect(await localScore(b, id)).toBe(160);
    expect(await localStreak(b, id)).toBe(3);
    expect(growthStageForXp(await localScore(b, id))).toBe(growthStageForXp(160));

    b.database.close();
  });

  it('holds even when the stale device has NO local progress row at all', async () => {
    const cloud = new FakeAuthoritativeCloud();
    const id = nextChildId();
    cloud.seedProgress(id, 160, 3);

    const b = await bootDevice(cloud, [id], BASE); // no seedLocalProgress → row absent
    await runAllSyncPaths(b, [id]);

    expect(cloud.cloudScore(id)).toBe(160);
    expect(await localScore(b, id)).toBe(160);
    b.database.close();
  });
});

// =======================================================================
// REQ 7 — multi-child: unrelated profiles never change.
// =======================================================================
describe('req 7 — multi-child: no unrelated profile is ever mutated', () => {
  it('A=160 B=20 C=620 D=40 survive repeated profile switches / foreground / sync on a device with missing local progress', async () => {
    const cloud = new FakeAuthoritativeCloud();
    const ids = [nextChildId(), nextChildId(), nextChildId(), nextChildId()] as const;
    const expected = [160, 20, 620, 40] as const;
    ids.forEach((id, i) => cloud.seedProgress(id, expected[i]!, 0));

    const device = await bootDevice(cloud, ids, BASE); // NO local profile_progress rows

    for (let round = 0; round < 4; round += 1) {
      await runAllSyncPaths(device, ids);
      ids.forEach((id, i) => expect(cloud.cloudScore(id)).toBe(expected[i]));
    }
    for (const [i, id] of ids.entries()) {
      expect(await localScore(device, id)).toBe(expected[i]);
    }
    device.database.close();
  });
});

// =======================================================================
// REQ 8 — reward: brand-new 0 → cloud 20, second device sees 20,
//          same evening repeated → +0, cloud stays 20.
// =======================================================================
describe('req 8 — a real reward', () => {
  it('brand-new child: first evening completion → cloud 20; second device sees 20; repeat → +0', async () => {
    const cloud = new FakeAuthoritativeCloud();
    const id = nextChildId();
    const slot = { period: 'evening', hour: 19 } as const;
    const dayKey = dayKeyOf(BASE);

    const a = await bootDevice(cloud, [id], BASE); // brand-new: no local progress row
    const first = await completeSlot(a, id, BASE, slot, 0);
    expect(first.authoritative?.xpGranted).toBe(20);
    expect(first.finalScore).toBe(20);
    expect(cloud.cloudScore(id)).toBe(20);
    expect(cloud.rewardedSlotCount(id, dayKey, slot.period)).toBe(1);

    const b = await bootDevice(cloud, [id], BASE);
    await runAllSyncPaths(b, [id]);
    expect(await localScore(b, id)).toBe(20);

    const repeat = await completeSlot(b, id, BASE, slot, 40);
    expect(repeat.authoritative?.xpGranted ?? 0).toBe(0);
    expect(repeat.finalScore).toBe(20);
    expect(cloud.cloudScore(id)).toBe(20);
    expect(cloud.rewardedSlotCount(id, dayKey, slot.period)).toBe(1);
    expect(growthStageForXp(20)).toBe(growthStageForXp(await localScore(b, id)));

    a.database.close();
    b.database.close();
  });
});

// =======================================================================
// REQ 9 — concurrent: two devices, same slot, at the same time → ONE +20.
// =======================================================================
describe('req 9 — concurrent claims on the same slot', () => {
  it('only one global +20; the final score increases exactly once', async () => {
    const cloud = new FakeAuthoritativeCloud();
    const id = nextChildId();
    cloud.seedProgress(id, 100, 0);
    const slot = { period: 'morning', hour: 8 } as const;
    const dayKey = dayKeyOf(BASE);

    const a = await bootDevice(cloud, [id], BASE);
    const b = await bootDevice(cloud, [id], BASE);
    await runAllSyncPaths(a, [id]);
    await runAllSyncPaths(b, [id]);

    // Both brush the SAME slot offline (each finishes locally with an optimistic +20)...
    a.clock.current = at(BASE, slot.hour, 0);
    const aLocal = await a.sessions.finish({
      sessionId: nextSessionId(),
      profileId: id,
      startedAt: a.clock.current.toISOString(),
      durationSeconds: 120,
    });
    b.clock.current = at(BASE, slot.hour, 1);
    const bLocal = await b.sessions.finish({
      sessionId: nextSessionId(),
      profileId: id,
      startedAt: b.clock.current.toISOString(),
      durationSeconds: 120,
    });

    // ...then both flush their claim to the one shared authoritative store.
    const aClaims = await a.sync.pushChild(id);
    const bClaims = await b.sync.pushChild(id);
    const grants = [
      aClaims.get(aLocal.session.id)?.xpGranted ?? 0,
      bClaims.get(bLocal.session.id)?.xpGranted ?? 0,
    ];

    expect(grants.filter((g) => g === 20)).toHaveLength(1); // exactly one winner
    expect(grants.filter((g) => g === 0)).toHaveLength(1);
    expect(cloud.cloudScore(id)).toBe(120); // 100 + a single +20
    expect(cloud.rewardedSlotCount(id, dayKey, slot.period)).toBe(1);
    expect(await localScore(a, id)).toBe(120);
    expect(await localScore(b, id)).toBe(120);

    a.database.close();
    b.database.close();
  });
});

// =======================================================================
// REQ 10 — penalty: the same missed slot evaluated / synced repeatedly → -10 once.
// =======================================================================
describe('req 10 — missed-slot penalty is applied exactly once', () => {
  it('repeated apply for the same (child, day, period) removes 10 total, never more', async () => {
    const cloud = new FakeAuthoritativeCloud();
    const id = nextChildId();
    cloud.seedProgress(id, 100, 0);
    const claim: SlotPenaltyClaim = {
      childId: id,
      localDayKey: dayKeyOf(BASE),
      period: 'morning',
      evaluatedAt: at(BASE, 12).toISOString(),
    };

    for (let i = 0; i < 5; i += 1) {
      const result = await cloud.applySlotPenalty(claim);
      expect(result.currentMineScore).toBe(90);
      expect(result.penaltyApplied).toBe(i === 0 ? -10 : 0);
    }
    expect(cloud.cloudScore(id)).toBe(90);
  });

  it('never drives the score below 0', async () => {
    const cloud = new FakeAuthoritativeCloud();
    const id = nextChildId();
    cloud.seedProgress(id, 5, 0);
    const result = await cloud.applySlotPenalty({
      childId: id,
      localDayKey: dayKeyOf(BASE),
      period: 'evening',
      evaluatedAt: at(BASE, 23).toISOString(),
    });
    expect(result.currentMineScore).toBe(0);
    expect(result.penaltyApplied).toBe(-5); // clamped: only 5 was there to remove
  });
});

// =======================================================================
// PROFILE-AGNOSTIC MATRIX — the reward invariant for many child shapes.
// =======================================================================
const SHAPES: readonly { label: string; seedMine: number | null }[] = [
  { label: 'brand-new child, 0 Mine, no cloud row', seedMine: null },
  { label: 'existing child, small non-zero Mine', seedMine: 40 },
  { label: 'existing child, below an evolution threshold', seedMine: 150 },
  { label: 'existing child, large non-zero Mine', seedMine: 620 },
];
const SLOTS = [
  { period: 'morning', hour: 8 },
  { period: 'evening', hour: 19 },
] as const;

for (const shape of SHAPES) {
  for (const slot of SLOTS) {
    describe(`invariant — ${shape.label} — ${slot.period}`, () => {
      it('first completion grants exactly +20; cloud reflects it; a second device converges; the slot never grants +20 again', async () => {
        const cloud = new FakeAuthoritativeCloud();
        const id = nextChildId();
        const dayKey = dayKeyOf(BASE);
        const base = shape.seedMine ?? 0;
        if (shape.seedMine !== null) cloud.seedProgress(id, shape.seedMine, 0);

        const a = await bootDevice(cloud, [id], BASE);
        await runAllSyncPaths(a, [id]);

        const first = await completeSlot(a, id, BASE, slot, 0);
        expect(first.authoritative?.xpGranted).toBe(20);
        expect(first.finalScore).toBe(base + 20);
        expect(cloud.cloudScore(id)).toBe(base + 20);

        const b = await bootDevice(cloud, [id], BASE);
        await runAllSyncPaths(b, [id]);
        expect(await localScore(b, id)).toBe(base + 20);

        const again = await completeSlot(b, id, BASE, slot, 30);
        expect(again.authoritative?.xpGranted ?? 0).toBe(0);
        expect(again.finalScore).toBe(base + 20);
        expect(cloud.cloudScore(id)).toBe(base + 20);
        expect(cloud.rewardedSlotCount(id, dayKey, slot.period)).toBe(1);
        expect(growthStageForXp(base + 20)).toBe(growthStageForXp(await localScore(b, id)));

        a.database.close();
        b.database.close();
      });
    });
  }
}
