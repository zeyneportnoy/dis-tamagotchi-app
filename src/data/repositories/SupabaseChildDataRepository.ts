import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CloudBrushingSession,
  CloudChildDataRepository,
  CloudChildProgress,
  CloudSlotEvaluation,
} from '@/domain/sync';

type ProgressRow = {
  child_id: string;
  current_mine_score: number;
  streak: number;
};

const mapProgress = (row: ProgressRow): CloudChildProgress => ({
  childId: row.child_id,
  currentMineScore: row.current_mine_score,
  streak: row.streak,
});

/**
 * Writes the child's Mine Puan progress, brushing sessions and slot evaluations
 * to Supabase. Every write is an idempotent upsert keyed on the same identity
 * the local tables use, so retries never create duplicate rows or a second
 * reward/penalty. RLS already scopes every row to the owning parent.
 */
export class SupabaseChildDataRepository implements CloudChildDataRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsertProgress(progress: CloudChildProgress): Promise<void> {
    const { error } = await this.client.from('child_progress').upsert(
      {
        child_id: progress.childId,
        current_mine_score: progress.currentMineScore,
        streak: progress.streak,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'child_id' },
    );
    if (error) throw new Error('CLOUD_PROGRESS_UPSERT_FAILED');
  }

  async upsertSession(session: CloudBrushingSession): Promise<void> {
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error('CLOUD_SESSION_UPSERT_FAILED');
  }

  async upsertSlotEvaluation(evaluation: CloudSlotEvaluation): Promise<void> {
    const { error } = await this.client.from('brushing_slot_evaluations').upsert(
      {
        child_id: evaluation.childId,
        local_day_key: evaluation.localDayKey,
        period: evaluation.period,
        outcome: evaluation.outcome,
        penalty_mine: evaluation.penaltyMine,
        evaluated_at: evaluation.evaluatedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'child_id,local_day_key,period' },
    );
    if (error) throw new Error('CLOUD_SLOT_EVALUATION_UPSERT_FAILED');
  }

  async listOwnedProgress(): Promise<readonly CloudChildProgress[]> {
    const { data, error } = await this.client
      .from('child_progress')
      .select('child_id, current_mine_score, streak');
    if (error) throw new Error('CLOUD_PROGRESS_LIST_FAILED');
    return (data as ProgressRow[]).map(mapProgress);
  }
}
