import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AgeBand, StarterAvatarKey } from '@/domain/family';
import type {
  CloudChildProfile,
  LocalProfileSyncRepository,
  PendingProfileRemoval,
} from '@/domain/sync';

type LegacyRow = {
  id: string;
  parent_auth_user_id: string | null;
  nickname: string;
  date_of_birth: string | null;
  age_band: AgeBand;
  avatar_id: StarterAvatarKey;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export class SQLiteProfileSyncRepository implements LocalProfileSyncRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async listClaimable(parentId: string): Promise<readonly CloudChildProfile[]> {
    const rows = await this.database.getAllAsync<LegacyRow>(
      `SELECT * FROM child_profiles
       WHERE sync_status IN ('legacy_local', 'pending', 'failed')
         AND (parent_auth_user_id IS NULL OR parent_auth_user_id = ?)
         AND archived_at IS NULL`,
      parentId,
    );
    return rows.map((row) => ({
      id: row.id,
      parentId: row.parent_auth_user_id ?? '',
      nickname: row.nickname,
      dateOfBirth: row.date_of_birth ?? null,
      ageBand: row.age_band,
      avatarId: row.avatar_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    }));
  }

  async countClaimable(parentId: string): Promise<number> {
    const row = await this.database.getFirstAsync<{ count: number }>(
      `SELECT count(*) AS count FROM child_profiles
       WHERE sync_status = 'legacy_local'
         AND (parent_auth_user_id IS NULL OR parent_auth_user_id = ?)
         AND archived_at IS NULL`,
      parentId,
    );
    return row?.count ?? 0;
  }

  async upsertCloud(profile: CloudChildProfile): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      const familyId = await this.ensureLocalFamilyId();
      await this.database.runAsync(
        `INSERT INTO child_profiles
          (id, family_id, nickname, date_of_birth, age_band, avatar_id, created_at, archived_at,
           remote_id, parent_auth_user_id, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname,
          date_of_birth = excluded.date_of_birth,
          age_band = excluded.age_band, avatar_id = excluded.avatar_id,
          archived_at = excluded.archived_at, remote_id = excluded.remote_id,
          parent_auth_user_id = excluded.parent_auth_user_id,
          sync_status = 'synced', updated_at = excluded.updated_at`,
        profile.id,
        familyId,
        profile.nickname,
        profile.dateOfBirth,
        profile.ageBand,
        profile.avatarId,
        profile.createdAt,
        profile.archivedAt,
        profile.id,
        profile.parentId,
        profile.updatedAt,
      );
      await this.database.runAsync(
        `INSERT OR IGNORE INTO active_parent_profile(parent_auth_user_id, child_profile_id)
         VALUES (?, ?)`,
        profile.parentId,
        profile.id,
      );
    });
  }

  /**
   * Cloud recovery can run before any local family exists (fresh install with an
   * account that already owns profiles). Bootstrap one instead of failing so the
   * recovered `child_profiles` rows have a valid `family_id`. Mirrors
   * `SQLiteFamilyRepository.createLocal`.
   */
  private async ensureLocalFamilyId(): Promise<string> {
    const existing = await this.database.getFirstAsync<{ id: string }>(
      'SELECT id FROM families ORDER BY created_at LIMIT 1',
    );
    if (existing) return existing.id;
    const id = randomUUID();
    await this.database.runAsync(
      `INSERT INTO families(id, created_at, locale, timezone, cloud_account_id)
       VALUES (?, ?, ?, ?, NULL)`,
      id,
      new Date().toISOString(),
      'tr-TR',
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
    );
    return id;
  }

  async markSynced(localId: string, parentId: string, remoteId: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `UPDATE child_profiles SET remote_id = ?, parent_auth_user_id = ?,
         sync_status = 'synced' WHERE id = ?
         AND (parent_auth_user_id IS NULL OR parent_auth_user_id = ?)`,
        remoteId,
        parentId,
        localId,
        parentId,
      );
      const legacyActive = await this.database.getFirstAsync<{ child_profile_id: string }>(
        `SELECT child_profile_id FROM active_profile
         WHERE singleton = 1 AND child_profile_id = ?`,
        localId,
      );
      if (legacyActive) {
        await this.database.runAsync(
          `INSERT INTO active_parent_profile(parent_auth_user_id, child_profile_id)
           VALUES (?, ?)
           ON CONFLICT(parent_auth_user_id) DO UPDATE SET child_profile_id = excluded.child_profile_id`,
          parentId,
          localId,
        );
      }
    });
  }

  async markFailed(localId: string): Promise<void> {
    await this.database.runAsync(
      "UPDATE child_profiles SET sync_status = 'failed' WHERE id = ?",
      localId,
    );
  }

  async listPendingRemovals(parentId: string): Promise<readonly PendingProfileRemoval[]> {
    const rows = await this.database.getAllAsync<{
      remote_id: string;
      mode: 'archive' | 'delete';
      archived_at: string | null;
    }>(
      `SELECT remote_id, mode, archived_at FROM pending_cloud_profile_removals
       WHERE parent_auth_user_id = ? ORDER BY requested_at`,
      parentId,
    );
    return rows.map((row) => ({
      remoteId: row.remote_id,
      mode: row.mode,
      archivedAt: row.archived_at,
    }));
  }

  async clearPendingRemoval(remoteId: string): Promise<void> {
    await this.database.runAsync(
      `DELETE FROM pending_cloud_profile_removals WHERE remote_id = ?`,
      remoteId,
    );
  }
}
