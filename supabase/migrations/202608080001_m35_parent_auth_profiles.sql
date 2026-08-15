create table if not exists public.parent_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_profiles (
  id uuid primary key,
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 20),
  age_band text not null check (age_band in ('4_6', '7_11')),
  avatar_id text not null check (avatar_id in ('cheerful-incisor', 'sleepy-molar', 'brave-canine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists child_profiles_parent_id_idx on public.child_profiles(parent_id);

alter table public.parent_profiles enable row level security;
alter table public.child_profiles enable row level security;

drop policy if exists "parent_select_own_profile" on public.parent_profiles;
create policy "parent_select_own_profile" on public.parent_profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "parent_update_own_profile" on public.parent_profiles;
create policy "parent_update_own_profile" on public.parent_profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "child_select_owned" on public.child_profiles;
create policy "child_select_owned" on public.child_profiles
  for select to authenticated using ((select auth.uid()) = parent_id);

drop policy if exists "child_insert_owned" on public.child_profiles;
create policy "child_insert_owned" on public.child_profiles
  for insert to authenticated with check ((select auth.uid()) = parent_id);

drop policy if exists "child_update_owned" on public.child_profiles;
create policy "child_update_owned" on public.child_profiles
  for update to authenticated using ((select auth.uid()) = parent_id)
  with check ((select auth.uid()) = parent_id);

drop policy if exists "child_delete_owned" on public.child_profiles;
create policy "child_delete_owned" on public.child_profiles
  for delete to authenticated using ((select auth.uid()) = parent_id);

create or replace function public.handle_new_parent()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.parent_profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Veli'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_parent();

revoke all on public.parent_profiles from anon;
revoke all on public.child_profiles from anon;
grant select, update on public.parent_profiles to authenticated;
grant select, insert, update, delete on public.child_profiles to authenticated;
