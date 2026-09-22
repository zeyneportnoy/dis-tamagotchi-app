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

type SyncedRemoteRow = {
  id: string;
  remote_id: string;
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

  async reconcileCloudSnapshot(
    parentId: string,
    activeRemoteIds: ReadonlySet<string>,
  ): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      const candidates = await this.database.getAllAsync<SyncedRemoteRow>(
        `SELECT child_profiles.id, child_profiles.remote_id
         FROM child_profiles
         WHERE child_profiles.parent_auth_user_id = ?
           AND child_profiles.sync_status = 'synced'
           AND child_profiles.remote_id IS NOT NULL
           AND child_profiles.archived_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM pending_cloud_profile_removals
             WHERE pending_cloud_profile_removals.parent_auth_user_id = ?
               AND pending_cloud_profile_removals.remote_id = child_profiles.remote_id
           )`,
        parentId,
        parentId,
      );
      const archivedAt = new Date().toISOString();
      for (const candidate of candidates) {
        if (activeRemoteIds.has(candidate.remote_id)) continue;
        const result = await this.database.runAsync(
          `UPDATE child_profiles SET archived_at = ?, updated_at = ?
           WHERE id = ?
             AND parent_auth_user_id = ?
             AND sync_status = 'synced'
             AND remote_id = ?
             AND archived_at IS NULL`,
          archivedAt,
          archivedAt,
          candidate.id,
          parentId,
          candidate.remote_id,
        );
        if (result.changes === 0) continue;
        await this.database.runAsync(
          `DELETE FROM active_parent_profile
           WHERE parent_auth_user_id = ? AND child_profile_id = ?`,
          parentId,
          candidate.id,
        );
      }
    });
  }

  async upsertCloud(profile: CloudChildProfile): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      // A locally-queued archive/delete for this child (see enqueueCloudRemoval /
      // pending_cloud_profile_removals) has not reached the cloud yet — the cloud
      // row we are about to recover is, by definition, the STALE pre-removal
      // state. Skip it entirely: writing it would resurrect an archived child
      // (or recreate a deleted one) for the short window before the outbox
      // flushes. Once the removal succeeds the cloud row disappears / gets
      // archived_at, so a later recovery pass naturally stops hitting this guard.
      const pendingRemoval = await this.database.getFirstAsync<{ remote_id: string }>(
        `SELECT remote_id FROM pending_cloud_profile_removals WHERE remote_id = ?`,
        profile.id,
      );
      if (pendingRemoval) return;

      const familyId = await this.ensureLocalFamilyId();
      // A local edit not yet pushed (sync_status 'pending' / 'failed', set by
      // ChildProfileRepository.update()) means THIS device's nickname / avatar /
      // age_band / archived_at is the newer, real value — the incoming cloud row
      // is what we are still waiting to overwrite, not a signal to trust. This
      // recovery call runs on every cold AND warm bootstrap (not just a fresh
      // install), so blindly accepting it would silently revert an edit the
      // moment it loses a race with its own (still in-flight) push, and — since
      // sync_status would otherwise reset to 'synced' — never retry it again.
      // date_of_birth does NOT follow the pending/failed local-edit guard above:
      // the product no longer collects or writes it anywhere, so it is not
      // something a pending local edit could ever legitimately be protecting.
      // The cloud is unconditionally authoritative for this one column —
      // `excluded.date_of_birth` (NULL on every real recovery now) always wins,
      // regardless of this row's sync_status, so a stale local birth date from
      // before the product change is cleared out even mid-edit.
      await this.database.runAsync(
        `INSERT INTO child_profiles
          (id, family_id, nickname, date_of_birth, age_band, avatar_id, created_at, archived_at,
           remote_id, parent_auth_user_id, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET
          nickname = CASE WHEN child_profiles.sync_status IN ('pending', 'failed')
            THEN child_profiles.nickname ELSE excluded.nickname END,
          date_of_birth = excluded.date_of_birth,
          age_band = CASE WHEN child_profiles.sync_status IN ('pending', 'failed')
            THEN child_profiles.age_band ELSE excluded.age_band END,
          avatar_id = CASE WHEN child_profiles.sync_status IN ('pending', 'failed')
            THEN child_profiles.avatar_id ELSE excluded.avatar_id END,
          archived_at = CASE WHEN child_profiles.sync_status IN ('pending', 'failed')
            THEN child_profiles.archived_at ELSE excluded.archived_at END,
          remote_id = excluded.remote_id,
          parent_auth_user_id = excluded.parent_auth_user_id,
          sync_status = CASE WHEN child_profiles.sync_status IN ('pending', 'failed')
            THEN child_profiles.sync_status ELSE 'synced' END,
          updated_at = CASE WHEN child_profiles.sync_status IN ('pending', 'failed')
            THEN child_profiles.updated_at ELSE excluded.updated_at END`,
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
