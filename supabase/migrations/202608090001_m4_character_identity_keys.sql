alter table public.child_profiles
  drop constraint if exists child_profiles_avatar_id_check;

update public.child_profiles
set avatar_id = case avatar_id
  when 'cheerful-incisor' then 'inci'
  when 'curious-tooth' then 'piril'
  when 'brave-canine' then 'kaan'
  when 'sunny-tooth' then 'milo'
  when 'starry-tooth' then 'zipzip'
  when 'shy-tooth' then 'topi'
  when 'sleepy-molar' then 'akil'
  when 'giggle-tooth' then 'uyku'
  else avatar_id
end;

alter table public.child_profiles
  add constraint child_profiles_avatar_id_check
  check (avatar_id in ('inci', 'piril', 'kaan', 'milo', 'zipzip', 'topi', 'akil', 'uyku'));
