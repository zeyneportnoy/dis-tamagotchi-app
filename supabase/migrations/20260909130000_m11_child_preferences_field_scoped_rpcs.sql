-- m11 (Phase 1) — Field-scoped, explicit-only write RPCs for public.child_preferences.
--
-- Backwards-compatible: this migration ONLY adds two controlled functions.
-- It does NOT change table grants, so the currently shipped client (whole-row
-- .upsert) keeps working untouched. Phase 2 (a SEPARATE migration, added only
-- after the explicit-mutation-outbox client is verified on real devices)
-- revokes the direct INSERT/UPDATE/DELETE/TRUNCATE grants on child_preferences.
--
-- Bug being fixed (prod 2026-09-09 09:48:06Z): a fresh / stale / second device
-- rebuilt the WHOLE child_preferences row from ambient local state
-- (defaultReminderSettings 08:00/20:30, legacy seed, seed-on-read, recovery
-- placeholder) and upserted it on every app foreground — 5 child rows reset
-- within 0.8s, 4 of them to 08:00/20:30.

begin;

-- 1) Establish a brand-new child's row without ever clobbering an existing one.
create or replace function public.initialize_child_preferences_if_absent(p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_child(p_child_id) then
    raise exception 'not_owner';
  end if;
  insert into public.child_preferences (child_id)
  values (p_child_id)
  on conflict (child_id) do nothing;
end;
$$;

-- 2) Field-scoped patch: update ONLY the whitelisted keys present in `p_patch`.
--    A key mapped to jsonb null clears that column to SQL NULL (a real user
--    choice); an ABSENT key is left completely untouched. An empty object is
--    rejected — a no-op call is a caller bug, not a valid write.
create or replace function public.patch_child_preferences(p_child_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed text[] := array[
    'selected_brush_id', 'selected_background_id', 'selected_effect_id',
    'room_configuration', 'voice_guide',
    'morning_reminder_enabled', 'morning_reminder_time',
    'evening_reminder_enabled', 'evening_reminder_time',
    'dentist_reminder_enabled', 'dentist_last_visit_date',
    'dentist_next_appointment_date', 'nickname_personalization_enabled'
  ];
  v_key text;
begin
  if not public.owns_child(p_child_id) then
    raise exception 'not_owner';
  end if;
  if p_patch is null
     or jsonb_typeof(p_patch) <> 'object'
     or p_patch = '{}'::jsonb then
    raise exception 'bad_patch';
  end if;
  foreach v_key in array (select array(select jsonb_object_keys(p_patch)))
  loop
    if not (v_key = any (v_allowed)) then
      raise exception 'field_not_allowed: %', v_key;
    end if;
  end loop;

  -- Row must exist before a partial update; never overwrites one that already does.
  insert into public.child_preferences (child_id)
  values (p_child_id)
  on conflict (child_id) do nothing;

  update public.child_preferences p set
    selected_brush_id = case when p_patch ? 'selected_brush_id'
      then nullif(p_patch->>'selected_brush_id', '') else p.selected_brush_id end,
    selected_background_id = case when p_patch ? 'selected_background_id'
      then nullif(p_patch->>'selected_background_id', '') else p.selected_background_id end,
    selected_effect_id = case when p_patch ? 'selected_effect_id'
      then nullif(p_patch->>'selected_effect_id', '') else p.selected_effect_id end,
    room_configuration = case when p_patch ? 'room_configuration'
      then (case when jsonb_typeof(p_patch->'room_configuration') = 'null'
        then null else p_patch->'room_configuration' end) else p.room_configuration end,
    voice_guide = case when p_patch ? 'voice_guide'
      then nullif(p_patch->>'voice_guide', '') else p.voice_guide end,
    morning_reminder_enabled = case when p_patch ? 'morning_reminder_enabled'
      then (p_patch->>'morning_reminder_enabled')::boolean else p.morning_reminder_enabled end,
    morning_reminder_time = case when p_patch ? 'morning_reminder_time'
      then nullif(p_patch->>'morning_reminder_time', '')::time else p.morning_reminder_time end,
    evening_reminder_enabled = case when p_patch ? 'evening_reminder_enabled'
      then (p_patch->>'evening_reminder_enabled')::boolean else p.evening_reminder_enabled end,
    evening_reminder_time = case when p_patch ? 'evening_reminder_time'
      then nullif(p_patch->>'evening_reminder_time', '')::time else p.evening_reminder_time end,
    dentist_reminder_enabled = case when p_patch ? 'dentist_reminder_enabled'
      then (p_patch->>'dentist_reminder_enabled')::boolean else p.dentist_reminder_enabled end,
    dentist_last_visit_date = case when p_patch ? 'dentist_last_visit_date'
      then nullif(p_patch->>'dentist_last_visit_date', '')::date else p.dentist_last_visit_date end,
    dentist_next_appointment_date = case when p_patch ? 'dentist_next_appointment_date'
      then nullif(p_patch->>'dentist_next_appointment_date', '')::date else p.dentist_next_appointment_date end,
    nickname_personalization_enabled = case when p_patch ? 'nickname_personalization_enabled'
      then (p_patch->>'nickname_personalization_enabled')::boolean else p.nickname_personalization_enabled end,
    updated_at = now()
  where p.child_id = p_child_id;
end;
$$;

-- 3) Lock down EXECUTE: strip the implicit PUBLIC grant (and anon explicitly),
--    then grant only to authenticated owners. RLS is bypassed inside a
--    SECURITY DEFINER function, so owns_child() above is the real gate.
revoke execute on function public.initialize_child_preferences_if_absent(uuid) from public;
revoke execute on function public.initialize_child_preferences_if_absent(uuid) from anon;
grant  execute on function public.initialize_child_preferences_if_absent(uuid) to authenticated;

revoke execute on function public.patch_child_preferences(uuid, jsonb) from public;
revoke execute on function public.patch_child_preferences(uuid, jsonb) from anon;
grant  execute on function public.patch_child_preferences(uuid, jsonb) to authenticated;

commit;
