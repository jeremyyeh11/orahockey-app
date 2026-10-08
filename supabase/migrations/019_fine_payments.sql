-- =============================================================
-- ORA Hockey — Paid fines
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- A fine is outstanding until an admin marks it paid (this table) or waives it
-- (fine_waivers, 018 — the waive reason goes in its `note`). Same key as a
-- waiver: one fine = player + entry + reason. Admins only for now (a
-- "finemaster" role is on the backlog).
--
-- Re-run safe.
-- =============================================================

create table if not exists public.fine_payments (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  item_type  text not null check (item_type in ('game', 'training', 'event', 'poll')),
  item_id    uuid not null,
  reason     text not null check (reason in ('late_reply', 'late_change')),
  paid_at    timestamptz not null default now(),
  marked_by  uuid references public.players(id) on delete set null,
  unique (player_id, item_type, item_id, reason)
);

alter table public.fine_payments enable row level security;
drop policy if exists "Signed-in users can view fine_payments" on public.fine_payments;
create policy "Signed-in users can view fine_payments" on public.fine_payments
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage fine_payments" on public.fine_payments;
create policy "Admins manage fine_payments" on public.fine_payments
  for all using (is_admin()) with check (is_admin());
