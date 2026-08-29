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

export class ChildExperienceUseCases {
  constructor(
    private readonly progress: ProfileProgressRepository,
    private readonly sessions: BrushingSessionRepository & RewardSessionRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async getProgress(profileId: string): Promise<ProfileProgress> {
    await this.sessions.reconcileMissedSlots(profileId);
    return this.progress.get(profileId);
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
