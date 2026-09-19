import type {
  BrushingPeriod,
  BrushingSession,
  BrushingSessionRepository,
  ProfileProgress,
  ProfileProgressRepository,
} from '@/domain/family';
import { BRUSHING_TOTAL_SECONDS } from '@/domain/brushing';
import type {
  BrushingRewardResult,
  AccessorySlot,
  InventoryItem,
  InventoryRepository,
  RewardItemKey,
  RewardSessionRepository,
} from '@/domain/rewards';
import { effectiveBackgroundKey, effectiveBrushKey, effectiveEffectKey } from '@/domain/rewards';

import { notifyChildProgressChanged } from './progressEvents';

export class ChildExperienceUseCases {
  constructor(
    private readonly progress: ProfileProgressRepository,
    private readonly sessions: BrushingSessionRepository & RewardSessionRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async getProgress(profileId: string): Promise<ProfileProgress> {
    const evaluations = await this.sessions.reconcileMissedSlots(profileId);
    const progress = await this.progress.get(profileId);
    await this.ensureEquippedItemsAreStillUnlocked(profileId, progress.totalXp);
    if (evaluations.length > 0) notifyChildProgressChanged(progress);
    return progress;
  }

  private async ensureEquippedItemsAreStillUnlocked(
    profileId: string,
    currentMineScore: number,
  ): Promise<void> {
    let equipped: readonly InventoryItem[];
    try {
      equipped = (await this.inventory.list(profileId)).filter((item) => item.equipped);
    } catch {
      // Progress reconciliation is authoritative even if preference access is
      // temporarily unavailable (for example while auth ownership is loading).
      return;
    }
    const selectedBrush = equipped.find((item) => item.slot === 'brush')?.key;
    const selectedBackground = equipped.find((item) => item.slot === 'background')?.key;
    const selectedEffect = equipped.find((item) => item.slot === 'effect')?.key;
    const fallbacks = [
      [selectedBrush, effectiveBrushKey(selectedBrush, currentMineScore)],
      [selectedBackground, effectiveBackgroundKey(selectedBackground, currentMineScore)],
      [selectedEffect, effectiveEffectKey(selectedEffect, currentMineScore)],
    ] as const;

    for (const [selectedKey, effectiveKey] of fallbacks) {
      if (selectedKey && selectedKey !== effectiveKey) {
        try {
          await this.equipItem(profileId, effectiveKey as RewardItemKey);
        } catch {
          // Consuming screens also enforce the same effective-key guard. A
          // later progress read retries this durable preference fallback.
        }
      }
    }
  }

  beginBrushingSession(sessionId: string, profileId: string, startedAt: string): Promise<void> {
    return this.sessions.begin({ sessionId, profileId, startedAt });
  }

  setBrushingCompleted(
    profileId: string,
    period: BrushingPeriod,
    completed: boolean,
  ): Promise<ProfileProgress> {
    return this.progress.setBrushingCompleted(profileId, period, completed);
  }

  completeBrushingSession(
    sessionId: string,
    profileId: string,
    startedAt: string,
  ): Promise<BrushingRewardResult> {
    return this.sessions.finish({
      sessionId,
      profileId,
      startedAt,
      durationSeconds: BRUSHING_TOTAL_SECONDS,
    });
  }

  async abandonBrushingSession(
    sessionId: string,
    profileId: string,
    startedAt: string,
    durationSeconds: number,
  ): Promise<void> {
    await this.sessions.finish({
      sessionId,
      profileId,
      startedAt,
      durationSeconds,
      completed: false,
    });
  }

  listCompletedSessions(profileId: string): Promise<readonly BrushingSession[]> {
    return this.sessions.listCompleted(profileId);
  }

  listInventory(profileId: string): Promise<readonly InventoryItem[]> {
    return this.inventory.list(profileId);
  }

  equipItem(profileId: string, itemKey: RewardItemKey): Promise<void> {
    return this.inventory.equip(profileId, itemKey);
  }

  unequipAccessorySlot(profileId: string, slot: AccessorySlot): Promise<void> {
    return this.inventory.unequipSlot(profileId, slot);
  }

  getEquippedItem(profileId: string): Promise<InventoryItem | null> {
    return this.inventory.getEquipped(profileId);
  }

  getEquippedItems(profileId: string): Promise<readonly InventoryItem[]> {
    return this.inventory.getEquippedItems(profileId);
  }
}
