-- Child game-data tables (progress / brushing history / slot evaluations /
-- preferences). The backend created these externally; this migration is the
-- repo's record of their required shape + row-level security. Every row is
-- reachable only through a child_profiles row owned by the authenticated
-- parent, and anon has no access.

create table if not exists public.child_progress (
  child_id uuid primary key references public.child_profiles(id) on delete cascade,
  current_mine_score integer not null default 0 check (current_mine_score >= 0),
  streak integer not null default 0 check (streak >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brushing_sessions (
  id uuid primary key,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  local_day_key date not null,
  period text not null check (period in ('morning', 'evening', 'off_slot')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  status text not null check (status in ('completed', 'interrupted')),
  reward_mine integer not null default 0 check (reward_mine in (0, 20)),
  timezone_offset_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brushing_sessions_child_idx on public.brushing_sessions(child_id);

create table if not exists public.brushing_slot_evaluations (
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  local_day_key date not null,
  period text not null check (period in ('morning', 'evening')),
  outcome text not null check (outcome in ('completed', 'missed')),
  penalty_mine integer not null default 0 check (penalty_mine in (0, -10)),
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (child_id, local_day_key, period)
);

create table if not exists public.child_preferences (
  child_id uuid primary key references public.child_profiles(id) on delete cascade,
  selected_brush_id text,
  selected_background_id text,
  selected_effect_id text,
  room_configuration jsonb,
  voice_guide text check (voice_guide is null or voice_guide in ('gokce', 'samet', 'off')),
  morning_reminder_enabled boolean,
  morning_reminder_time time,
  evening_reminder_enabled boolean,
  evening_reminder_time time,
  dentist_reminder_enabled boolean,
  dentist_last_visit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.child_progress enable row level security;
alter table public.brushing_sessions enable row level security;
alter table public.brushing_slot_evaluations enable row level security;
alter table public.child_preferences enable row level security;

-- One helper predicate per table: the child_id must belong to a child_profiles
-- row whose parent is the caller.
create or replace function public.owns_child(target_child_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.child_profiles cp
    where cp.id = target_child_id and cp.parent_id = (select auth.uid())
  );
$$;

drop policy if exists "child_progress_owned" on public.child_progress;
create policy "child_progress_owned" on public.child_progress
  for all to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id));

drop policy if exists "brushing_sessions_owned" on public.brushing_sessions;
create policy "brushing_sessions_owned" on public.brushing_sessions
  for all to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id));

drop policy if exists "brushing_slot_evaluations_owned" on public.brushing_slot_evaluations;
create policy "brushing_slot_evaluations_owned" on public.brushing_slot_evaluations
  for all to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id));

drop policy if exists "child_preferences_owned" on public.child_preferences;
create policy "child_preferences_owned" on public.child_preferences
  for all to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id));

revoke all on public.child_progress from anon;
revoke all on public.brushing_sessions from anon;
revoke all on public.brushing_slot_evaluations from anon;
revoke all on public.child_preferences from anon;
grant select, insert, update, delete on public.child_progress to authenticated;
grant select, insert, update, delete on public.brushing_sessions to authenticated;
grant select, insert, update, delete on public.brushing_slot_evaluations to authenticated;
grant select, insert, update, delete on public.child_preferences to authenticated;
