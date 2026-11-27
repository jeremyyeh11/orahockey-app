-- =============================================================
-- ORA Hockey — Deleting a fine charged by mistake
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP), after 043
-- =============================================================
--
-- Waiving keeps a fine on the list at $0 with a reason. Deleting removes it
-- for everyone, for fines that should never have been charged.
--
--   manual fines     (042) are deleted outright, along with their waiver /
--                    payment rows: no new table needed.
--   derived fines    are recomputed on every page load (018), so deleting one
--                    records its key here and computeFines skips it.
--
-- Finemasters and the superadmin only (can_manage_fines(), 035).
-- Additive: older app code never reads the table. Re-run safe.
-- =============================================================

create table if not exists public.fine_deletions (
  player_id   uuid not null references public.players(id) on delete cascade,
  item_type   text not null check (item_type in ('game', 'training', 'event', 'poll')),
  item_id     uuid not null,
  reason      text not null check (reason in ('late_reply', 'late_change')),
  deleted_by  uuid references public.players(id) on delete set null,
  deleted_at  timestamptz not null default now(),
  primary key (player_id, item_type, item_id, reason)
);

alter table public.fine_deletions enable row level security;
drop policy if exists "Signed-in users can view fine_deletions" on public.fine_deletions;
create policy "Signed-in users can view fine_deletions" on public.fine_deletions
  for select using (auth.role() = 'authenticated');
drop policy if exists "Fine managers manage fine_deletions" on public.fine_deletions;
create policy "Fine managers manage fine_deletions" on public.fine_deletions
  for all using (can_manage_fines()) with check (can_manage_fines());
