import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AuthoritativeProgress,
  BrushingSlotClaim,
  CloudBrushingPeriod,
  CloudBrushingSession,
  CloudBrushingSessionStatus,
  CloudChildDataRepository,
  CloudChildProgress,
  CloudSlotEvaluation,
  SlotPenaltyClaim,
} from '@/domain/sync';

type ProgressRow = {
  child_id: string;
  current_mine_score: number;
  streak: number;
  updated_at: string | null;
};

type SessionRow = {
  id: string;
  child_id: string;
  local_day_key: string;
  period: CloudBrushingPeriod;
  started_at: string;
  completed_at: string;
  status: CloudBrushingSessionStatus;
  reward_mine: number;
  timezone_offset_minutes: number | null;
  updated_at: string | null;
};

type EvaluationRow = {
  child_id: string;
  local_day_key: string;
  period: 'morning' | 'evening';
  outcome: 'completed' | 'missed';
  penalty_mine: number;
  applied_penalty_mine: number | null;
  evaluated_at: string;
  updated_at: string | null;
};

/** Shape returned by the `claim_brushing_slot` / `apply_slot_penalty` RPCs. */
type AuthoritativeRow = {
  child_id: string;
  xp_granted: number;
  penalty_applied: number;
  current_mine_score: number;
  streak: number;
  morning_completed: boolean;
  evening_completed: boolean;
  already_resolved: boolean;
  updated_at: string;
};

const mapAuthoritative = (row: AuthoritativeRow): AuthoritativeProgress => ({
  childId: row.child_id,
  xpGranted: row.xp_granted === 20 ? 20 : 0,
  penaltyApplied: Math.max(-10, Math.min(0, row.penalty_applied)),
  currentMineScore: Math.max(0, row.current_mine_score),
  streak: Math.max(0, row.streak),
  morningCompleted: row.morning_completed === true,
  eveningCompleted: row.evening_completed === true,
  alreadyResolved: row.already_resolved === true,
  updatedAt: row.updated_at,
});

const mapProgress = (row: ProgressRow): CloudChildProgress => ({
  childId: row.child_id,
  currentMineScore: row.current_mine_score,
  streak: row.streak,
  updatedAt: row.updated_at ?? undefined,
});

const mapSession = (row: SessionRow): CloudBrushingSession => ({
  id: row.id,
  childId: row.child_id,
  localDayKey: row.local_day_key,
  period: row.period,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  status: row.status,
  rewardMine: row.reward_mine === 20 ? 20 : 0,
  timezoneOffsetMinutes: row.timezone_offset_minutes ?? 0,
  updatedAt: row.updated_at ?? undefined,
});

const mapEvaluation = (row: EvaluationRow): CloudSlotEvaluation => ({
  childId: row.child_id,
  localDayKey: row.local_day_key,
  period: row.period,
  outcome: row.outcome,
  penaltyMine: row.penalty_mine === -10 ? -10 : 0,
  appliedPenaltyMine:
    row.applied_penalty_mine === null ? null : Math.max(-10, Math.min(0, row.applied_penalty_mine)),
  evaluatedAt: row.evaluated_at,
  updatedAt: row.updated_at ?? undefined,
});

/**
 * Cloud data access for a child's Mine Puan progress, brushing sessions and
 * slot evaluations.
 *
 * The absolute `current_mine_score` / `streak` are OWNED BY THE SERVER: the
 * client holds no `child_progress` write grant and this class exposes no method
 * that sends an absolute score. Score changes go only through the atomic,
 * idempotent RPCs `claim_brushing_slot` / `apply_slot_penalty`, which return the
 * new authoritative values. History rows (interrupted / off-slot sessions, slot
 * evaluations) are still plain idempotent upserts keyed on their stable id.
 */
export class SupabaseChildDataRepository implements CloudChildDataRepository {
  constructor(private readonly client: SupabaseClient) {}

  async claimBrushingSlot(claim: BrushingSlotClaim): Promise<AuthoritativeProgress> {
    const { data, error } = await this.client
      .rpc('claim_brushing_slot', {
        p_child_id: claim.childId,
        p_session_id: claim.sessionId,
        p_local_day_key: claim.localDayKey,
        p_period: claim.period,
        p_started_at: claim.startedAt,
        p_completed_at: claim.completedAt,
        p_timezone_offset_minutes: claim.timezoneOffsetMinutes,
      })
      .single();
    if (error || !data) throw new Error('CLOUD_REWARD_CLAIM_FAILED');
    return mapAuthoritative(data as AuthoritativeRow);
  }

  async applySlotPenalty(claim: SlotPenaltyClaim): Promise<AuthoritativeProgress> {
    const { data, error } = await this.client
      .rpc('apply_slot_penalty', {
        p_child_id: claim.childId,
        p_local_day_key: claim.localDayKey,
        p_period: claim.period,
        p_evaluated_at: claim.evaluatedAt,
      })
      .single();
    if (error || !data) throw new Error('CLOUD_SLOT_PENALTY_FAILED');
    return mapAuthoritative(data as AuthoritativeRow);
  }

  async upsertSession(session: CloudBrushingSession): Promise<string> {
    const updatedAt = new Date().toISOString();
    const { error } = await this.client.from('brushing_sessions').upsert(
      {
        id: session.id,
        child_id: session.childId,
        local_day_key: session.localDayKey,
        period: session.period,
        started_at: session.startedAt,
        completed_at: session.completedAt,
        status: session.status,
        reward_mine: session.rewardMine,
        timezone_offset_minutes: session.timezoneOffsetMinutes,
        updated_at: updatedAt,
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error('CLOUD_SESSION_UPSERT_FAILED');
    return updatedAt;
  }

  async upsertSlotEvaluation(evaluation: CloudSlotEvaluation): Promise<string> {
    const updatedAt = new Date().toISOString();
    const { error } = await this.client.from('brushing_slot_evaluations').upsert(
      {
        child_id: evaluation.childId,
        local_day_key: evaluation.localDayKey,
        period: evaluation.period,
        outcome: evaluation.outcome,
        penalty_mine: evaluation.penaltyMine,
        applied_penalty_mine: evaluation.appliedPenaltyMine,
        evaluated_at: evaluation.evaluatedAt,
        updated_at: updatedAt,
      },
      { onConflict: 'child_id,local_day_key,period' },
    );
    if (error) throw new Error('CLOUD_SLOT_EVALUATION_UPSERT_FAILED');
    return updatedAt;
  }

  async getProgress(childId: string): Promise<CloudChildProgress | null> {
    const { data, error } = await this.client
      .from('child_progress')
      .select('child_id, current_mine_score, streak, updated_at')
      .eq('child_id', childId)
      .maybeSingle();
    if (error) throw new Error('CLOUD_PROGRESS_GET_FAILED');
    return data ? mapProgress(data as ProgressRow) : null;
  }

  async listOwnedProgress(): Promise<readonly CloudChildProgress[]> {
    const { data, error } = await this.client
      .from('child_progress')
      .select('child_id, current_mine_score, streak, updated_at');
    if (error) throw new Error('CLOUD_PROGRESS_LIST_FAILED');
    return (data as ProgressRow[]).map(mapProgress);
  }

  async listOwnedSessions(): Promise<readonly CloudBrushingSession[]> {
    const { data, error } = await this.client
      .from('brushing_sessions')
      .select(
        'id, child_id, local_day_key, period, started_at, completed_at, status, reward_mine, timezone_offset_minutes, updated_at',
      );
    if (error) throw new Error('CLOUD_SESSION_LIST_FAILED');
    return (data as SessionRow[]).map(mapSession);
  }

  async listOwnedSlotEvaluations(): Promise<readonly CloudSlotEvaluation[]> {
    const { data, error } = await this.client
      .from('brushing_slot_evaluations')
      .select(
        'child_id, local_day_key, period, outcome, penalty_mine, applied_penalty_mine, evaluated_at, updated_at',
      );
    if (error) throw new Error('CLOUD_SLOT_EVALUATION_LIST_FAILED');
    return (data as EvaluationRow[]).map(mapEvaluation);
  }
}
