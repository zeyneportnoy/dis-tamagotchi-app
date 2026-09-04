-- Preserves the ACTUAL clamped Mine Puan delta a slot evaluation applied (not
-- just the fixed -10 intent already in penalty_mine), so a device recovering
-- this row later can compute an exact refund if it turns out to conflict with
-- a genuine completed+rewarded session, instead of guessing.
--
-- Semantics:
--   - `missed` outcome: the real amount removed at evaluation time, already
--     clamped by the score floor (e.g. -5 when the score was 5 and a -10 slot
--     penalty only had 5 left to remove). Range: -10..0.
--   - `completed` outcome: always 0 — a completed slot never carries an
--     artificial penalty.
--   - NULL: this row predates this column (a legacy row pushed by an older
--     app version). The real delta is unknown and MUST NOT be guessed by any
--     repair pass — a NULL row is refund-ambiguous by design and hydrates
--     locally as "no known loss" (0), never as an invented -10/+10.
--
-- Purely additive: nullable, no default, no backfill, no rewrite of existing
-- rows.
alter table public.brushing_slot_evaluations
  add column if not exists applied_penalty_mine integer
    check (applied_penalty_mine is null or applied_penalty_mine between -10 and 0);
