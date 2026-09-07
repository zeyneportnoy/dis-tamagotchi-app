-- m10 (follow-up) — Complete the child_progress write lockdown.
--
-- 20260907183730 revoked insert / update / delete on public.child_progress
-- from authenticated so the absolute Mine score can only change through the
-- claim_brushing_slot / apply_slot_penalty RPCs. TRUNCATE is a separate
-- privilege in Postgres — revoke it too, so no client can wipe the table.

revoke truncate on public.child_progress from authenticated;
