-- 2026-09-08: Fix OUT-parameter/column ambiguity using explicit table aliases.
-- Name the child_progress PK conflict target to avoid ambiguous child_id inference.
-- Reward/penalty logic and permissions are unchanged. No backfill or data updates.

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
    select 1 from public.brushing_sessions bs
    where bs.child_id = p_child_id and bs.local_day_key = p_local_day_key
      and bs.period = p_period and bs.reward_mine = 20 and bs.status = 'completed'
  ) into v_already;

  if not v_already then
    begin
      update public.brushing_sessions bs set reward_mine = 20 where bs.id = p_session_id;
      v_won := true;
    exception when unique_violation then
      v_won := false; -- lost a concurrent race for this slot
    end;
  end if;

  insert into public.child_progress (child_id, current_mine_score, streak)
  values (p_child_id, 0, 0)
  on conflict on constraint child_progress_pkey do nothing;

  if v_won then
    update public.child_progress cp
       set current_mine_score = cp.current_mine_score + 20, updated_at = v_updated
     where cp.child_id = p_child_id;
  end if;

  v_streak := public.derive_child_streak(p_child_id, p_local_day_key);
  update public.child_progress cp
     set streak = v_streak, updated_at = v_updated
   where cp.child_id = p_child_id
  returning cp.current_mine_score into v_score;

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
    select 1 from public.brushing_sessions bs
    where bs.child_id = p_child_id and bs.local_day_key = p_local_day_key
      and bs.period = p_period and bs.status = 'completed'
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
  on conflict on constraint child_progress_pkey do nothing;

  select cp.current_mine_score into v_before
    from public.child_progress cp where cp.child_id = p_child_id;

  if v_won and not v_completed then
    update public.child_progress cp
       set current_mine_score = greatest(0, cp.current_mine_score - 10), updated_at = v_updated
     where cp.child_id = p_child_id
    returning cp.current_mine_score into v_after;
    v_penalty := v_after - v_before; -- 0 .. -10, already clamped by the floor
    update public.brushing_slot_evaluations bse
       set applied_penalty_mine = v_penalty
     where bse.child_id = p_child_id and bse.local_day_key = p_local_day_key and bse.period = p_period;
  end if;

  v_streak := public.derive_child_streak(p_child_id, p_local_day_key);
  update public.child_progress cp
     set streak = v_streak, updated_at = v_updated
   where cp.child_id = p_child_id
  returning cp.current_mine_score into v_score;

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
