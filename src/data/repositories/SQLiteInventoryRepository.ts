import type { SQLiteDatabase } from 'expo-sqlite';

import {
  isBrushUnlockedForScore,
  rewardCatalog,
  rewardItemForKey,
  type AccessorySlot,
  type InventoryItem,
  type InventoryRepository,
  type RewardItemKey,
} from '@/domain/rewards';

type InventoryRow = {
  item_key: RewardItemKey;
  unlocked_at: string;
  equipped: number;
  slot: AccessorySlot;
};

export class SQLiteInventoryRepository implements InventoryRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly getActiveParentId: () => Promise<string | null>,
  ) {}

  private async assertOwned(profileId: string): Promise<void> {
    const parentId = await this.getActiveParentId();
    if (!parentId) throw new Error('AUTH_REQUIRED');
    const owned = await this.database.getFirstAsync<{ id: string }>(
      `SELECT id FROM child_profiles
       WHERE id = ? AND parent_auth_user_id = ? AND archived_at IS NULL`,
      profileId,
      parentId,
    );
    if (!owned) throw new Error('PROFILE_NOT_FOUND');
  }

  async list(profileId: string): Promise<readonly InventoryItem[]> {
    await this.assertOwned(profileId);
    const rows = await this.database.getAllAsync<InventoryRow>(
      `SELECT item_key, unlocked_at, equipped, slot FROM inventory_items
       WHERE child_profile_id = ?`,
      profileId,
    );
    const byKey = new Map(rows.map((row) => [row.item_key, row]));
    return rewardCatalog.map((catalogItem) => {
      const row = byKey.get(catalogItem.key);
      return {
        ...catalogItem,
        unlocked: Boolean(row),
        equipped: row?.equipped === 1,
        unlockedAt: row?.unlocked_at ?? null,
      };
    });
  }

  async equip(profileId: string, itemKey: RewardItemKey): Promise<void> {
    await this.assertOwned(profileId);
    const slot = rewardItemForKey(itemKey).slot;
    await this.database.withTransactionAsync(async () => {
      let unlocked = await this.database.getFirstAsync<{ item_key: string }>(
        `SELECT item_key FROM inventory_items
         WHERE child_profile_id = ? AND item_key = ?`,
        profileId,
        itemKey,
      );
      // Brush availability is defined by the child's current Mine balance. Older
      // profiles can legitimately satisfy that gate without having a matching
      // inventory row (only one reward used to be materialized per threshold).
      // Materialize the selected brush through the existing inventory source of
      // truth before equipping it; a below-threshold brush is still rejected.
      if (!unlocked && slot === 'brush') {
        const progress = await this.database.getFirstAsync<{ total_xp: number }>(
          'SELECT total_xp FROM profile_progress WHERE child_profile_id = ?',
          profileId,
        );
        if (isBrushUnlockedForScore(itemKey, Math.max(0, progress?.total_xp ?? 0))) {
          await this.database.runAsync(
            `INSERT OR IGNORE INTO inventory_items
              (child_profile_id, item_key, unlocked_at, equipped, slot)
             VALUES (?, ?, ?, 0, ?)`,
            profileId,
            itemKey,
            new Date().toISOString(),
            slot,
          );
          unlocked = { item_key: itemKey };
        }
      }
      if (!unlocked) throw new Error('ITEM_LOCKED');
      await this.database.runAsync(
        'UPDATE inventory_items SET equipped = 0 WHERE child_profile_id = ? AND slot = ?',
        profileId,
        slot,
      );
      await this.database.runAsync(
        `UPDATE inventory_items SET equipped = 1
         WHERE child_profile_id = ? AND item_key = ?`,
        profileId,
        itemKey,
      );
    });
  }

  async unequipSlot(profileId: string, slot: AccessorySlot): Promise<void> {
    await this.assertOwned(profileId);
    await this.database.runAsync(
      'UPDATE inventory_items SET equipped = 0 WHERE child_profile_id = ? AND slot = ?',
      profileId,
      slot,
    );
  }

  async getEquipped(profileId: string): Promise<InventoryItem | null> {
    return (await this.list(profileId)).filter((item) => item.equipped).at(-1) ?? null;
  }

  async getEquippedItems(profileId: string): Promise<readonly InventoryItem[]> {
    return (await this.list(profileId)).filter((item) => item.equipped);
  }
}
