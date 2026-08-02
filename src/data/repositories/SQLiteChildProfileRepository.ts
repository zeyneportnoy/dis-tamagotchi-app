import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createChildProfileSchema,
  type ChildProfile,
  type ChildProfileRepository,
  type CreateChildProfileInput,
  type StarterAvatarKey,
  type UpdateChildProfileInput,
  updateChildProfileSchema,
} from '@/domain/family';

type ProfileRow = {
  id: string;
  family_id: string;
  nickname: string;
  age_band: '6_8' | '9_10';
  avatar_id: StarterAvatarKey;
  created_at: string;
  archived_at: string | null;
};

const mapProfile = (row: ProfileRow): ChildProfile => ({
  id: row.id,
  familyId: row.family_id,
  nickname: row.nickname,
  ageBand: row.age_band,
  avatarId: row.avatar_id,
  createdAt: row.created_at,
  archivedAt: row.archived_at,
});

export class SQLiteChildProfileRepository implements ChildProfileRepository {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async create(rawInput: CreateChildProfileInput): Promise<ChildProfile> {
    const input = createChildProfileSchema.parse(rawInput);
    const profile: ChildProfile = {
      id: this.createId(),
      familyId: input.familyId,
      nickname: input.nickname,
      ageBand: input.ageBand,
      avatarId: input.avatarId,
      createdAt: this.now(),
      archivedAt: null,
    };
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `INSERT INTO child_profiles
          (id, family_id, nickname, age_band, avatar_id, created_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        profile.id,
        profile.familyId,
        profile.nickname,
        profile.ageBand,
        profile.avatarId,
        profile.createdAt,
      );
      await this.database.runAsync(
        'UPDATE active_profile SET child_profile_id = ? WHERE singleton = 1',
        profile.id,
      );
    });
    return profile;
  }

  async list(familyId: string): Promise<readonly ChildProfile[]> {
    const rows = await this.database.getAllAsync<ProfileRow>(
      `SELECT * FROM child_profiles
       WHERE family_id = ? AND archived_at IS NULL ORDER BY created_at`,
      familyId,
    );
    return rows.map(mapProfile);
  }

  async getActive(): Promise<ChildProfile | null> {
    const row = await this.database.getFirstAsync<ProfileRow>(
      `SELECT child_profiles.* FROM child_profiles
       INNER JOIN active_profile ON active_profile.child_profile_id = child_profiles.id
       WHERE active_profile.singleton = 1 AND child_profiles.archived_at IS NULL`,
    );
    return row ? mapProfile(row) : null;
  }

  async selectActive(profileId: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      const profile = await this.database.getFirstAsync<{ id: string }>(
        'SELECT id FROM child_profiles WHERE id = ? AND archived_at IS NULL',
        profileId,
      );
      if (!profile) throw new Error('PROFILE_NOT_FOUND');
      await this.database.runAsync(
        'UPDATE active_profile SET child_profile_id = ? WHERE singleton = 1',
        profileId,
      );
    });
  }

  async update(profileId: string, rawInput: UpdateChildProfileInput): Promise<ChildProfile> {
    const input = updateChildProfileSchema.parse(rawInput);
    const current = await this.database.getFirstAsync<ProfileRow>(
      'SELECT * FROM child_profiles WHERE id = ? AND archived_at IS NULL',
      profileId,
    );
    if (!current) throw new Error('PROFILE_NOT_FOUND');
    const updated = {
      nickname: input.nickname ?? current.nickname,
      ageBand: input.ageBand ?? current.age_band,
      avatarId: input.avatarId ?? current.avatar_id,
    };
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        'UPDATE child_profiles SET nickname = ?, age_band = ?, avatar_id = ? WHERE id = ?',
        updated.nickname,
        updated.ageBand,
        updated.avatarId,
        profileId,
      );
    });
    return { ...mapProfile(current), ...updated };
  }

  async archive(profileId: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        'UPDATE child_profiles SET archived_at = ? WHERE id = ?',
        this.now(),
        profileId,
      );
      await this.database.runAsync(
        `UPDATE active_profile SET child_profile_id = NULL
         WHERE singleton = 1 AND child_profile_id = ?`,
        profileId,
      );
    });
  }

  async delete(profileId: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync('DELETE FROM child_profiles WHERE id = ?', profileId);
    });
  }
}
