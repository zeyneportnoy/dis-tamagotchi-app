-- Mirrors the local dentist_reminders.next_appointment_date column so a second
-- device or a reinstall can recover the parent-entered next appointment date
-- and reschedule the -1-day-at-09:00 reminder locally. Additive, nullable, no
-- backfill — a legacy row with no appointment yet stays null.
alter table public.child_preferences
  add column if not exists dentist_next_appointment_date date;
