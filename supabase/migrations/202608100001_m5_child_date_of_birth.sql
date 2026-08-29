-- Exact date of birth is the product source of truth; age_band is derived from
-- it in the app. Nullable: legacy local profiles may not carry one yet, and
-- backfilling those is a separate migration.
alter table public.child_profiles
  add column if not exists date_of_birth date;
