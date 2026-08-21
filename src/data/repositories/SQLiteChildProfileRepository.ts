import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createChildProfileSchema,
  type ChildProfile,
  type ChildProfileRepository,
  type CreateChildProfileInput,
  type StarterAvatarKey,
  type StoredAgeBand,
  type ProfileSyncStatus,
  type UpdateChildProfileInput,
  updateChildProfileSchema,
} from '@/domain/family';

type ProfileRow = {
  id: string;
  family_id: string;
  nickname: string;
  age_band: StoredAgeBand;
  avatar_id: string;
  created_at: string;
  archived_at: string | null;
  remote_id: string | null;
  parent_auth_user_id: string | null;
  sync_status: ProfileSyncStatus;
  updated_at: string;
};

const legacyAvatarKeys: Record<string, StarterAvatarKey> = {
  'cheerful-incisor': 'inci',
  'curious-tooth': 'piril',
  'brave-canine': 'kaan',
  'sunny-tooth': 'milo',
  'starry-tooth': 'zipzip',
  'shy-tooth': 'topi',
  'sleepy-molar': 'akil',
  'giggle-tooth': 'uyku',
};

const normalizeAvatarKey = (key: string): StarterAvatarKey =>
  legacyAvatarKeys[key] ?? (key as StarterAvatarKey);

const mapProfile = (row: ProfileRow): ChildProfile => ({
  id: row.id,
  familyId: row.family_id,
  nickname: row.nickname,
  ageBand: row.age_band,
  avatarId: normalizeAvatarKey(row.avatar_id),
  createdAt: row.created_at,
  archivedAt: row.archived_at,
  remoteId: row.remote_id,
  parentAuthUserId: row.parent_auth_user_id,
  syncStatus: row.sync_status,
  updatedAt: row.updated_at,
});

export class SQLiteChildProfileRepository implements ChildProfileRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly getActiveParentId: () => Promise<string | null> = async () => null,
  ) {}

  private async requireActiveParentId(): Promise<string> {
    const parentId = await this.getActiveParentId();
    if (!parentId) throw new Error('AUTH_REQUIRED');
    return parentId;
  }

  async create(rawInput: CreateChildProfileInput): Promise<ChildProfile> {
    const input = createChildProfileSchema.parse(rawInput);
    const parentId = await this.requireActiveParentId();
    const profile: ChildProfile = {
      id: this.createId(),
      familyId: input.familyId,
      nickname: input.nickname,
      ageBand: input.ageBand,
      avatarId: input.avatarId,
      createdAt: this.now(),
      archivedAt: null,
      remoteId: null,
      parentAuthUserId: parentId,
      syncStatus: 'pending',
      updatedAt: this.now(),
    };
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `INSERT INTO child_profiles
          (id, family_id, nickname, age_band, avatar_id, created_at, archived_at,
           remote_id, parent_auth_user_id, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        profile.id,
        profile.familyId,
        profile.nickname,
        profile.ageBand,
        profile.avatarId,
        profile.createdAt,
        profile.parentAuthUserId,
        profile.syncStatus,
        profile.updatedAt,
      );
      await this.database.runAsync(
        `INSERT INTO active_parent_profile(parent_auth_user_id, child_profile_id)
         VALUES (?, ?)
         ON CONFLICT(parent_auth_user_id) DO UPDATE SET child_profile_id = excluded.child_profile_id`,
        parentId,
        profile.id,
      );
      await this.database.runAsync(
        `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
         VALUES (?, 'cozy-scarf', ?, 1, 'decor')`,
        profile.id,
        profile.createdAt,
      );
      for (const [key, slot] of [
        ['pastel-playroom', 'background'],
        ['bubble-glow', 'effect'],
        ['classic-brush', 'brush'],
      ] as const) {
        await this.database.runAsync(
          `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
           VALUES (?, ?, ?, 1, ?)`,
          profile.id,
          key,
          profile.createdAt,
          slot,
        );
      }
    });
    return profile;
  }

  async list(familyId: string): Promise<readonly ChildProfile[]> {
    const parentId = await this.requireActiveParentId();
    const rows = await this.database.getAllAsync<ProfileRow>(
      `SELECT * FROM child_profiles
       WHERE family_id = ? AND parent_auth_user_id = ? AND archived_at IS NULL ORDER BY created_at`,
      familyId,
      parentId,
    );
    return rows.map(mapProfile);
  }

  async getActive(): Promise<ChildProfile | null> {
    const parentId = await this.requireActiveParentId();
    const row = await this.database.getFirstAsync<ProfileRow>(
      `SELECT child_profiles.* FROM child_profiles
       INNER JOIN active_parent_profile
         ON active_parent_profile.child_profile_id = child_profiles.id
       WHERE active_parent_profile.parent_auth_user_id = ?
         AND child_profiles.parent_auth_user_id = ?
         AND child_profiles.archived_at IS NULL`,
      parentId,
      parentId,
    );
    return row ? mapProfile(row) : null;
  }

  async selectActive(profileId: string): Promise<void> {
    const parentId = await this.requireActiveParentId();
    await this.database.withTransactionAsync(async () => {
      const profile = await this.database.getFirstAsync<{ id: string }>(
        `SELECT id FROM child_profiles
         WHERE id = ? AND parent_auth_user_id = ? AND archived_at IS NULL`,
        profileId,
        parentId,
      );
      if (!profile) throw new Error('PROFILE_NOT_FOUND');
      await this.database.runAsync(
        `INSERT INTO active_parent_profile(parent_auth_user_id, child_profile_id)
         VALUES (?, ?)
         ON CONFLICT(parent_auth_user_id) DO UPDATE SET child_profile_id = excluded.child_profile_id`,
        parentId,
        profileId,
      );
    });
  }

  async update(profileId: string, rawInput: UpdateChildProfileInput): Promise<ChildProfile> {
    const input = updateChildProfileSchema.parse(rawInput);
    const parentId = await this.requireActiveParentId();
    const current = await this.database.getFirstAsync<ProfileRow>(
      `SELECT * FROM child_profiles
       WHERE id = ? AND parent_auth_user_id = ? AND archived_at IS NULL`,
      profileId,
      parentId,
    );
    if (!current) throw new Error('PROFILE_NOT_FOUND');
    const updated = {
      nickname: input.nickname ?? current.nickname,
      ageBand: input.ageBand ?? current.age_band,
      avatarId: input.avatarId ?? normalizeAvatarKey(current.avatar_id),
    };
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `UPDATE child_profiles SET nickname = ?, age_band = ?, avatar_id = ?,
          sync_status = 'pending', updated_at = ?
          WHERE id = ? AND parent_auth_user_id = ?`,
        updated.nickname,
        updated.ageBand,
        updated.avatarId,
        this.now(),
        profileId,
        parentId,
      );
    });
    return { ...mapProfile(current), ...updated };
  }

  async archive(profileId: string): Promise<void> {
    const parentId = await this.requireActiveParentId();
    await this.database.withTransactionAsync(async () => {
      const result = await this.database.runAsync(
        `UPDATE child_profiles SET archived_at = ?
         WHERE id = ? AND parent_auth_user_id = ?`,
        this.now(),
        profileId,
        parentId,
      );
      if (result.changes === 0) throw new Error('PROFILE_NOT_FOUND');
      await this.database.runAsync(
        `DELETE FROM active_parent_profile
         WHERE parent_auth_user_id = ? AND child_profile_id = ?`,
        parentId,
        profileId,
      );
    });
  }

  async delete(profileId: string): Promise<void> {
    const parentId = await this.requireActiveParentId();
    await this.database.withTransactionAsync(async () => {
      const result = await this.database.runAsync(
        'DELETE FROM child_profiles WHERE id = ? AND parent_auth_user_id = ?',
        profileId,
        parentId,
      );
      if (result.changes === 0) throw new Error('PROFILE_NOT_FOUND');
    });
  }
}
