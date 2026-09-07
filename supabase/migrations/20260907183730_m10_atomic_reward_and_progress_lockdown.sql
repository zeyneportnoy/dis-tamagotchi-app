-- m10 — Server-authoritative Mine Puan.
--
-- Root cause of the "a stale / freshly-started device zeroed several children's
-- child_progress.current_mine_score" incident: the client held an UPDATE grant
-- on public.child_progress and pushed its local profile_progress.total_xp as an
-- ABSOLUTE value. A device whose local row was just created (default 0, never
-- synced) counted as "dirty" and overwrote the authoritative cloud score.
--
-- This migration removes client authority over the absolute score entirely and
-- replaces the blind upsert with two atomic, idempotent, per-slot RPCs that are
-- the ONLY things allowed to change current_mine_score / streak.

begin;

-- 1) The client can no longer write an absolute score. -----------------------
--    SELECT stays (pull is fine). All writes now go through the SECURITY
--    DEFINER functions below, which re-check ownership via public.owns_child().
revoke insert, update, delete on public.child_progress from authenticated;

-- 2) Global "exactly one +20 per (child, local day, period)" guarantee. ------
--    Two devices can each hold their own completed session row for the slot,
--    but only one of them may ever carry the reward.
create unique index if not exists brushing_sessions_rewarded_slot_uq
  on public.brushing_sessions (child_id, local_day_key, period)
  where reward_mine = 20 and status = 'completed';

-- 3) A direct client INSERT/UPDATE on brushing_sessions can never self-award:
--    only a reward RPC (which sets a txn-local flag) may store reward_mine = 20.
create or replace function public.enforce_server_only_reward_mine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.reward_claim_in_progress', true), '') <> 'on'
     and coalesce(new.reward_mine, 0) <> 0 then
    new.reward_mine := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists brushing_sessions_reward_mine_guard on public.brushing_sessions;
create trigger brushing_sessions_reward_mine_guard
  before insert or update on public.brushing_sessions
  for each row execute function public.enforce_server_only_reward_mine();

-- 4) Authoritative streak: consecutive local calendar days (ending on p_as_of
--    or the day before) on which BOTH slots have a completed session. Derived
--    purely from canonical brushing_sessions — never a counter, never a value
--    the client proposed. Mirrors the client's deriveStreak() exactly.
create or replace function public.derive_child_streak(p_child_id uuid, p_as_of date)
returns integer
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_streak integer := 0;
  v_expected date := null;
  r record;
begin
  for r in
    select fd.local_day_key
    from (
      select local_day_key
      from public.brushing_sessions
      where child_id = p_child_id
        and status = 'completed'
        and period in ('morning', 'evening')
        and local_day_key <= p_as_of
      group by local_day_key
      having count(distinct period) = 2
    ) fd
    order by fd.local_day_key desc
  loop
    if v_expected is null then
      if r.local_day_key < p_as_of - 1 then
        return 0;
      end if;
    elsif r.local_day_key <> v_expected then
      exit;
    end if;
    v_streak := v_streak + 1;
    v_expected := r.local_day_key - 1;
  end loop;
  return v_streak;
end;
$$;

-- 5) Claim THE reward for a completed morning/evening slot. -----------------
--    Idempotent on p_session_id AND on (child, day, period). One transaction:
--    record the session, atomically win-or-lose the rewarded-slot row, apply
--    +20 only if won, recompute the authoritative streak, return everything.
create or replace function public.claim_brushing_slot(
  p_child_id uuid,
  p_session_id uuid,
  p_local_day_key date,
  p_period text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_timezone_offset_minutes integer
)
returns table (
  child_id uuid,
  xp_granted integer,
  penalty_applied integer,
  current_mine_score integer,
  streak integer,
  morning_completed boolean,
  evening_completed boolean,
  already_resolved boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_already boolean;
  v_won boolean := false;
  v_score integer;
  v_streak integer;
  v_updated timestamptz := now();
begin
  if not public.owns_child(p_child_id) then
    raise exception 'not_owner';
  end if;
  if p_period not in ('morning', 'evening') then
    raise exception 'bad_period';
  end if;

  perform set_config('app.reward_claim_in_progress', 'on', true);

  insert into public.brushing_sessions
    (id, child_id, local_day_key, period, started_at, completed_at, status,
     reward_mine, timezone_offset_minutes)
  values
    (p_session_id, p_child_id, p_local_day_key, p_period, p_started_at, p_completed_at,
     'completed', 0, p_timezone_offset_minutes)
  on conflict (id) do nothing;

  select exists (
    select 1 from public.brushing_sessions
    where child_id = p_child_id and local_day_key = p_local_day_key
      and period = p_period and reward_mine = 20 and status = 'completed'
  ) into v_already;

  if not v_already then
    begin
      update public.brushing_sessions set reward_mine = 20 where id = p_session_id;
      v_won := true;
    exception when unique_violation then
      v_won := false; -- lost a concurrent race for this slot
    end;
  end if;

  insert into public.child_progress (child_id, current_mine_score, streak)
  values (p_child_id, 0, 0)
  on conflict (child_id) do nothing;

  if v_won then
    update public.child_progress
       set current_mine_score = current_mine_score + 20, updated_at = v_updated
     where public.child_progress.child_id = p_child_id;
  end if;

  v_streak := public.derive_child_streak(p_child_id, p_local_day_key);
  update public.child_progress
     set streak = v_streak, updated_at = v_updated
   where public.child_progress.child_id = p_child_id
  returning public.child_progress.current_mine_score into v_score;

  return query
    select
      p_child_id,
      case when v_won then 20 else 0 end,
      0,
      v_score,
      v_streak,
      exists (select 1 from public.brushing_sessions s
              where s.child_id = p_child_id and s.local_day_key = p_local_day_key
                and s.period = 'morning' and s.status = 'completed'),
      exists (select 1 from public.brushing_sessions s
              where s.child_id = p_child_id and s.local_day_key = p_local_day_key
                and s.period = 'evening' and s.status = 'completed'),
      not v_won,
      v_updated;
end;
$$;

-- 6) Apply THE penalty for a closed, unbrushed slot. -----------------------
--    Idempotent on (child, day, period). Never penalises a slot that has a
--    completed session. Records the ACTUAL clamped delta.
create or replace function public.apply_slot_penalty(
  p_child_id uuid,
  p_local_day_key date,
  p_period text,
  p_evaluated_at timestamptz
)
returns table (
  child_id uuid,
  xp_granted integer,
  penalty_applied integer,
  current_mine_score integer,
  streak integer,
  morning_completed boolean,
  evening_completed boolean,
  already_resolved boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed boolean;
  v_won boolean := false;
  v_before integer;
  v_after integer;
  v_penalty integer := 0;
  v_score integer;
  v_streak integer;
  v_updated timestamptz := now();
begin
  if not public.owns_child(p_child_id) then
    raise exception 'not_owner';
  end if;
  if p_period not in ('morning', 'evening') then
    raise exception 'bad_period';
  end if;

  select exists (
    select 1 from public.brushing_sessions
    where child_id = p_child_id and local_day_key = p_local_day_key
      and period = p_period and status = 'completed'
  ) into v_completed;

  begin
    insert into public.brushing_slot_evaluations
      (child_id, local_day_key, period, outcome, penalty_mine, applied_penalty_mine, evaluated_at)
    values
      (p_child_id, p_local_day_key, p_period,
       case when v_completed then 'completed' else 'missed' end,
       case when v_completed then 0 else -10 end,
       null, p_evaluated_at);
    v_won := true;
  exception when unique_violation then
    v_won := false; -- already evaluated
  end;

  insert into public.child_progress (child_id, current_mine_score, streak)
  values (p_child_id, 0, 0)
  on conflict (child_id) do nothing;

  select public.child_progress.current_mine_score into v_before
    from public.child_progress where public.child_progress.child_id = p_child_id;

  if v_won and not v_completed then
    update public.child_progress
       set current_mine_score = greatest(0, current_mine_score - 10), updated_at = v_updated
     where public.child_progress.child_id = p_child_id
    returning public.child_progress.current_mine_score into v_after;
    v_penalty := v_after - v_before; -- 0 .. -10, already clamped by the floor
    update public.brushing_slot_evaluations
       set applied_penalty_mine = v_penalty
     where child_id = p_child_id and local_day_key = p_local_day_key and period = p_period;
  end if;

  v_streak := public.derive_child_streak(p_child_id, p_local_day_key);
  update public.child_progress
     set streak = v_streak, updated_at = v_updated
   where public.child_progress.child_id = p_child_id
  returning public.child_progress.current_mine_score into v_score;

  return query
    select
      p_child_id,
      0,
      v_penalty,
      v_score,
      v_streak,
      exists (select 1 from public.brushing_sessions s
              where s.child_id = p_child_id and s.local_day_key = p_local_day_key
                and s.period = 'morning' and s.status = 'completed'),
      exists (select 1 from public.brushing_sessions s
              where s.child_id = p_child_id and s.local_day_key = p_local_day_key
                and s.period = 'evening' and s.status = 'completed'),
      not v_won,
      v_updated;
end;
$$;

-- 7) Only authenticated owners may call the RPCs; anon has nothing. ---------
revoke all on function public.derive_child_streak(uuid, date) from anon;
revoke all on function public.claim_brushing_slot(uuid, uuid, date, text, timestamptz, timestamptz, integer) from anon;
revoke all on function public.apply_slot_penalty(uuid, date, text, timestamptz) from anon;
grant execute on function public.claim_brushing_slot(uuid, uuid, date, text, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.apply_slot_penalty(uuid, date, text, timestamptz) to authenticated;

commit;
