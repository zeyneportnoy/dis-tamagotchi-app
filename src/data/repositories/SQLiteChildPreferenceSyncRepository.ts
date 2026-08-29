import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AccessorySlot } from '@/domain/rewards';
import type { LocalChildPreferenceSyncRepository } from '@/domain/sync';
import {
  customizationStorageKey,
  decodeCustomizationState,
  type CustomizationState,
} from '@/features/customization';

type ChildRow = {
  id: string;
  remote_id: string | null;
  parent_auth_user_id: string | null;
  sync_status: string;
};

type EquippedRow = { slot: AccessorySlot; item_key: string };

/**
 * Local side of child preference sync. Reads the current selection + room
 * configuration from the customization store (falling back to the prod
 * `inventory_items` equipped rows) and hydrates a recovered configuration back
 * verbatim — the render-time unlock guards decide what actually activates.
 */
export class SQLiteChildPreferenceSyncRepository implements LocalChildPreferenceSyncRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  private async loadChild(profileId: string): Promise<ChildRow | null> {
    return this.database.getFirstAsync<ChildRow>(
      `SELECT id, remote_id, parent_auth_user_id, sync_status FROM child_profiles
       WHERE id = ? AND archived_at IS NULL`,
      profileId,
    );
  }

  async resolveRemoteChildId(profileId: string): Promise<string | null> {
    const row = await this.loadChild(profileId);
    if (!row || row.sync_status !== 'synced') return null;
    return row.remote_id ?? null;
  }

  async resolveParentUserId(profileId: string): Promise<string | null> {
    const row = await this.loadChild(profileId);
    return row?.parent_auth_user_id ?? null;
  }

  async listSyncedProfileIds(): Promise<readonly string[]> {
    const rows = await this.database.getAllAsync<{ id: string }>(
      `SELECT id FROM child_profiles
       WHERE sync_status = 'synced' AND remote_id IS NOT NULL AND archived_at IS NULL`,
    );
    return rows.map((row) => row.id);
  }

  async findProfileByRemoteChildId(remoteChildId: string): Promise<string | null> {
    const row = await this.database.getFirstAsync<{ id: string }>(
      `SELECT id FROM child_profiles
       WHERE (id = ? OR remote_id = ?) AND archived_at IS NULL LIMIT 1`,
      remoteChildId,
      remoteChildId,
    );
    return row?.id ?? null;
  }

  private async loadCustomization(profileId: string): Promise<CustomizationState> {
    return decodeCustomizationState(await AsyncStorage.getItem(customizationStorageKey(profileId)));
  }

  private async equippedInventory(profileId: string): Promise<Partial<Record<AccessorySlot, string>>> {
    const rows = await this.database.getAllAsync<EquippedRow>(
      `SELECT slot, item_key FROM inventory_items WHERE child_profile_id = ? AND equipped = 1`,
      profileId,
    );
    const bySlot: Partial<Record<AccessorySlot, string>> = {};
    for (const row of rows) bySlot[row.slot] = row.item_key;
    return bySlot;
  }

  async readCustomizationForPush(profileId: string): Promise<
    Readonly<{
      selectedBrushId: string | null;
      selectedBackgroundId: string | null;
      selectedEffectId: string | null;
      roomConfiguration: unknown;
    }>
  > {
    const state = await this.loadCustomization(profileId);
    const equipped = await this.equippedInventory(profileId);
    const resolve = (slot: AccessorySlot): string | null => {
      if (Object.prototype.hasOwnProperty.call(state.developerEquipped, slot)) {
        return state.developerEquipped[slot] ?? null;
      }
      return equipped[slot] ?? null;
    };
    return {
      selectedBrushId: resolve('brush'),
      selectedBackgroundId: resolve('background'),
      selectedEffectId: resolve('effect'),
      roomConfiguration: state,
    };
  }

  async dentistReminderEnabled(profileId: string): Promise<boolean> {
    const row = await this.database.getFirstAsync<{ child_profile_id: string }>(
      `SELECT child_profile_id FROM dentist_reminders WHERE child_profile_id = ?`,
      profileId,
    );
    return Boolean(row);
  }

  async hasLocalCustomization(profileId: string): Promise<boolean> {
    return (await AsyncStorage.getItem(customizationStorageKey(profileId))) !== null;
  }

  async hydrateCustomization(profileId: string, roomConfiguration: unknown): Promise<void> {
    if (roomConfiguration == null) return;
    // Re-decode so only valid keys/placements land locally, then persist verbatim.
    const raw =
      typeof roomConfiguration === 'string' ? roomConfiguration : JSON.stringify(roomConfiguration);
    const state = decodeCustomizationState(raw);
    await AsyncStorage.setItem(customizationStorageKey(profileId), JSON.stringify(state));
  }
}
