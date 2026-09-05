-- Mirrors the local per-child "brushing says the child's name" toggle
-- (preferences.parent.<parentId>.child.<childId>.brushing.nickname-personalization
-- in AsyncStorage) so it survives a second device or a reinstall. Additive,
-- nullable: null means no device has ever resolved this preference for the
-- child yet, distinct from a real "off" (false) value a parent explicitly set.
alter table public.child_preferences
  add column if not exists nickname_personalization_enabled boolean;
