-- m11 — Field-scoped cloud writes for a child's brushing REMINDER preferences.
--
-- Root cause of "hatırlatıcı saatleri birkaç gün sonra 08:00 / 20:30
-- varsayılanına geri dönüyor": the client rebuilt the WHOLE
-- public.child_preferences row from ambient local state (defaultReminderSettings
-- 08:00/20:30, the pre-per-child legacy seed, ReminderSettingsService.get()'s
-- seed-on-read, and the recovery placeholder record) and upserted it on every
-- app foreground (AuthProvider -> retryPendingCloudSync ->
-- syncAllChildPreferences -> pushForAllSyncedChildren). A device that never held
-- the parent's custom time therefore pushed the 08:00 / 20:30 default straight
-- back over another device's real edit; recover() is seed-once for reminders
-- (m8/m9-era fixes) so it never repaired the clobbered value.
--
-- Scope of this migration: brushing reminders ONLY. selected_brush_id /
-- selected_background_id / selected_effect_id / room_configuration / voice_guide
-- / dentist_* / nickname_personalization_enabled keep their existing table-level
-- write grant and the existing whole-row client upsert path — untouched here.
--
-- Two paired changes:
--   1. A column-level REVOKE so the client can no longer write the four
--      reminder columns directly (the upsert path physically cannot carry an
--      ambient default again, even by a future regression).
--   2. patch_child_reminders(child_id, patch) — the ONLY way the client changes
--      a cloud reminder value now: field-scoped, security definer, re-checks
--      ownership, updates ONLY the reminder keys explicitly present in `patch`
--      (each carrying the exact value the parent chose at edit time).

begin;

-- 1) Remove the client's direct write authority for the reminder columns only.
--    SELECT is untouched (recovery still pulls them). Every other column keeps
--    its existing insert/update grant from m6.
revoke insert (morning_reminder_enabled, morning_reminder_time,
               evening_reminder_enabled, evening_reminder_time)
  on public.child_preferences from authenticated;
revoke update (morning_reminder_enabled, morning_reminder_time,
               evening_reminder_enabled, evening_reminder_time)
  on public.child_preferences from authenticated;

-- 2) Field-scoped reminder patch. `p_patch` is a jsonb object such as
--    {"morning_reminder_time":"07:15","morning_reminder_enabled":true}.
--    A key that is ABSENT is left completely untouched; a key present with
--    jsonb null clears that column to SQL NULL (a real "no time set" choice).
--    Non-reminder columns and every other child row are never touched.
create or replace function public.patch_child_reminders(p_child_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed text[] := array[
    'morning_reminder_enabled', 'morning_reminder_time',
    'evening_reminder_enabled', 'evening_reminder_time'
  ];
  v_key text;
begin
  if not public.owns_child(p_child_id) then
    raise exception 'not_owner';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'bad_patch';
  end if;
  if p_patch = '{}'::jsonb then
    return;
  end if;
  foreach v_key in array (select array(select jsonb_object_keys(p_patch)))
  loop
    if not (v_key = any (v_allowed)) then
      raise exception 'field_not_allowed: %', v_key;
    end if;
  end loop;

  -- The row must exist before a partial update; never overwrites one that does.
  insert into public.child_preferences (child_id)
  values (p_child_id)
  on conflict (child_id) do nothing;

  update public.child_preferences p set
    morning_reminder_enabled = case when p_patch ? 'morning_reminder_enabled'
      then (p_patch->>'morning_reminder_enabled')::boolean
      else p.morning_reminder_enabled end,
    morning_reminder_time = case when p_patch ? 'morning_reminder_time'
      then nullif(p_patch->>'morning_reminder_time', '')::time
      else p.morning_reminder_time end,
    evening_reminder_enabled = case when p_patch ? 'evening_reminder_enabled'
      then (p_patch->>'evening_reminder_enabled')::boolean
      else p.evening_reminder_enabled end,
    evening_reminder_time = case when p_patch ? 'evening_reminder_time'
      then nullif(p_patch->>'evening_reminder_time', '')::time
      else p.evening_reminder_time end,
    updated_at = now()
  where p.child_id = p_child_id;
end;
$$;

-- 3) Only authenticated owners may call the controlled writer.
revoke all on function public.patch_child_reminders(uuid, jsonb) from anon;
grant execute on function public.patch_child_reminders(uuid, jsonb) to authenticated;

commit;
