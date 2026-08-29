import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  isBackgroundRewardKey,
  isBackgroundUnlockedForScore,
  isBrushRewardKey,
  isBrushUnlockedForScore,
  isEffectRewardKey,
  isEffectUnlockedForScore,
  type AccessorySlot,
  type RewardItemKey,
} from '@/domain/rewards';
import type { CloudChildPreferences, LocalChildPreferenceSyncRepository } from '@/domain/sync';
import {
  customizationStorageKey,
  decodeCustomizationState,
  type CustomizationState,
} from '@/features/customization';

type ScoreGatedSlot = 'brush' | 'background' | 'effect';

const isRewardKeyForSlot = (slot: ScoreGatedSlot, key: string): boolean =>
  slot === 'brush'
    ? isBrushRewardKey(key)
    : slot === 'background'
      ? isBackgroundRewardKey(key)
      : isEffectRewardKey(key);

const isUnlockedForSlot = (slot: ScoreGatedSlot, key: string, score: number): boolean =>
  slot === 'brush'
    ? isBrushUnlockedForScore(key, score)
    : slot === 'background'
      ? isBackgroundUnlockedForScore(key, score)
      : isEffectUnlockedForScore(key, score);

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

  async hydrateCustomization(
    profileId: string,
    preferences: CloudChildPreferences,
  ): Promise<void> {
    const { roomConfiguration } = preferences;
    const raw =
      roomConfiguration == null
        ? null
        : typeof roomConfiguration === 'string'
          ? roomConfiguration
          : JSON.stringify(roomConfiguration);
    const decoded = decodeCustomizationState(raw);

    // Overlay the dedicated selection columns so the DEV developer-override path
    // reflects the cloud choice even when room_configuration carried none.
    const developerEquipped = { ...decoded.developerEquipped };
    const selections: readonly [ScoreGatedSlot, string | null][] = [
      ['brush', preferences.selectedBrushId],
      ['background', preferences.selectedBackgroundId],
      ['effect', preferences.selectedEffectId],
    ];
    for (const [slot, key] of selections) {
      if (key && isRewardKeyForSlot(slot, key)) developerEquipped[slot] = key as RewardItemKey;
    }
    const state: CustomizationState = { ...decoded, developerEquipped };
    await AsyncStorage.setItem(customizationStorageKey(profileId), JSON.stringify(state));

    // Production source of truth: equip score-unlocked selections in
    // `inventory_items` too. Locked picks are skipped — the existing render-time
    // guards keep them inactive until the balance is high enough.
    const progress = await this.database.getFirstAsync<{ total_xp: number }>(
      `SELECT total_xp FROM profile_progress WHERE child_profile_id = ?`,
      profileId,
    );
    const score = Math.max(0, progress?.total_xp ?? 0);
    for (const [slot, key] of selections) {
      if (!key || !isRewardKeyForSlot(slot, key) || !isUnlockedForSlot(slot, key, score)) continue;
      await this.database.withTransactionAsync(async () => {
        await this.database.runAsync(
          `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
           VALUES (?, ?, ?, 0, ?)`,
          profileId,
          key,
          new Date().toISOString(),
          slot,
        );
        await this.database.runAsync(
          `UPDATE inventory_items SET equipped = 0 WHERE child_profile_id = ? AND slot = ?`,
          profileId,
          slot,
        );
        await this.database.runAsync(
          `UPDATE inventory_items SET equipped = 1 WHERE child_profile_id = ? AND item_key = ?`,
          profileId,
          key,
        );
      });
    }
  }
}
