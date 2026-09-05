import { getParentAuthUseCases } from '@/application/auth';
import {
  ensureChildDataRecovered,
  syncChildBrushingSession,
  syncChildCloudProgress,
  syncChildPreferences,
} from '@/application/sync';
import { getDatabase } from '@/data/db';
import {
  SQLiteBrushingSessionRepository,
  SQLiteInventoryRepository,
  SQLiteProfileProgressRepository,
} from '@/data/repositories';
import type { ProfileProgress } from '@/domain/family';
import type { AccessorySlot, BrushingRewardResult, RewardItemKey } from '@/domain/rewards';

import { ChildExperienceUseCases } from './useCases';

/**
 * Adds best-effort Supabase persistence around the local child experience: after
 * a local write succeeds, the change is pushed to the cloud in the background.
 * The push is fire-and-forget — a network/Supabase failure never blocks the UI,
 * rolls back Mine Puan, deletes a session or re-runs a penalty.
 */
export class CloudAwareChildExperienceUseCases extends ChildExperienceUseCases {
  override async getProgress(profileId: string): Promise<ProfileProgress> {
    // Missed-slot reconciliation (inside super.getProgress) must never run
    // ahead of cloud history hydration: an unhydrated local device looks
    // exactly like a wall of missed slots and would apply a real -10 penalty
    // for brushing that already happened and was already recorded — on this
    // device in a prior session, or on another device entirely. Every screen
    // that reads progress (Home, Tasks, Profile, Collection, Brushing) goes
    // through this single override, so gating here — not in each screen —
    // is what actually guarantees the rule. `ensureChildDataRecovered` is
    // memoized per session, so this is a no-op await once recovery has
    // already completed.
    await ensureChildDataRecovered();
    // getProgress also runs missed-slot reconciliation; pushing here catches any
    // resulting -10 penalty and its slot evaluation.
    const progress = await super.getProgress(profileId);
    void syncChildCloudProgress(profileId, {
      totalXp: progress.totalXp,
      currentStreak: progress.currentStreak,
    });
    return progress;
  }

  override async completeBrushingSession(
    sessionId: string,
    profileId: string,
    startedAt: string,
  ): Promise<BrushingRewardResult> {
    const result = await super.completeBrushingSession(sessionId, profileId, startedAt);
    void syncChildBrushingSession(profileId, sessionId);
    return result;
  }

  override async abandonBrushingSession(
    sessionId: string,
    profileId: string,
    startedAt: string,
    durationSeconds: number,
  ): Promise<void> {
    await super.abandonBrushingSession(sessionId, profileId, startedAt, durationSeconds);
    void syncChildBrushingSession(profileId, sessionId);
  }

  override async equipItem(profileId: string, itemKey: RewardItemKey): Promise<void> {
    await super.equipItem(profileId, itemKey);
    void syncChildPreferences(profileId);
  }

  override async unequipAccessorySlot(profileId: string, slot: AccessorySlot): Promise<void> {
    await super.unequipAccessorySlot(profileId, slot);
    void syncChildPreferences(profileId);
  }
}

let useCasesPromise: Promise<ChildExperienceUseCases> | undefined;

export function getChildExperienceUseCases(): Promise<ChildExperienceUseCases> {
  useCasesPromise ??= getDatabase().then((database) => {
    const getActiveParentId = async (): Promise<string | null> =>
      (await getParentAuthUseCases()?.getSession())?.userId ?? null;
    return new CloudAwareChildExperienceUseCases(
      new SQLiteProfileProgressRepository(database),
      new SQLiteBrushingSessionRepository(database, undefined, undefined, getActiveParentId),
      new SQLiteInventoryRepository(database, getActiveParentId),
    );
  });
  return useCasesPromise;
}
