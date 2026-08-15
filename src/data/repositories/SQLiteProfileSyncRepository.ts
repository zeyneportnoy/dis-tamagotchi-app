import type { SQLiteDatabase } from 'expo-sqlite';

import type { AgeBand, StarterAvatarKey } from '@/domain/family';
import type { CloudChildProfile, LocalProfileSyncRepository } from '@/domain/sync';

type LegacyRow = {
  id: string;
  parent_auth_user_id: string | null;
  nickname: string;
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
      const family = await this.database.getFirstAsync<{ id: string }>(
        'SELECT id FROM families LIMIT 1',
      );
      if (!family) throw new Error('LOCAL_FAMILY_REQUIRED');
      await this.database.runAsync(
        `INSERT INTO child_profiles
          (id, family_id, nickname, age_band, avatar_id, created_at, archived_at,
           remote_id, parent_auth_user_id, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname,
          age_band = excluded.age_band, avatar_id = excluded.avatar_id,
          archived_at = excluded.archived_at, remote_id = excluded.remote_id,
          parent_auth_user_id = excluded.parent_auth_user_id,
          sync_status = 'synced', updated_at = excluded.updated_at`,
        profile.id,
        family.id,
        profile.nickname,
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
}
