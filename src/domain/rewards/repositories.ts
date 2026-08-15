import type { BrushingRewardResult, FinishBrushingSessionInput, InventoryItem } from './models';
import type { RewardItemKey } from './catalog';

export interface RewardSessionRepository {
  finish(input: FinishBrushingSessionInput): Promise<BrushingRewardResult>;
}

export interface InventoryRepository {
  list(profileId: string): Promise<readonly InventoryItem[]>;
  equip(profileId: string, itemKey: RewardItemKey): Promise<void>;
  unequipSlot(profileId: string, slot: import('./catalog').AccessorySlot): Promise<void>;
  getEquipped(profileId: string): Promise<InventoryItem | null>;
  getEquippedItems(profileId: string): Promise<readonly InventoryItem[]>;
}
