import type { SupabaseClient } from '@supabase/supabase-js';

import type { AgeBand, StarterAvatarKey } from '@/domain/family';
import type { CloudChildProfile, CloudChildProfileRepository } from '@/domain/sync';

type CloudRow = {
  id: string;
  parent_id: string;
  nickname: string;
  age_band: AgeBand;
  avatar_id: StarterAvatarKey;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const mapRow = (row: CloudRow): CloudChildProfile => ({
  id: row.id,
  parentId: row.parent_id,
  nickname: row.nickname,
  ageBand: row.age_band,
  avatarId: row.avatar_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  archivedAt: row.archived_at,
});

export class SupabaseChildProfileRepository implements CloudChildProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listOwned(): Promise<readonly CloudChildProfile[]> {
    const { data, error } = await this.client
      .from('child_profiles')
      .select('*')
      .is('archived_at', null)
      .order('created_at');
    if (error) throw new Error('CLOUD_PROFILE_LIST_FAILED');
    return (data as CloudRow[]).map(mapRow);
  }

  async upsert(profile: CloudChildProfile): Promise<CloudChildProfile> {
    const { data, error } = await this.client
      .from('child_profiles')
      .upsert(
        {
          id: profile.id,
          parent_id: profile.parentId,
          nickname: profile.nickname,
          age_band: profile.ageBand,
          avatar_id: profile.avatarId,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt,
          archived_at: profile.archivedAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    if (error) throw new Error('CLOUD_PROFILE_UPSERT_FAILED');
    return mapRow(data as CloudRow);
  }
}
