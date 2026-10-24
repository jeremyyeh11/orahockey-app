-- =============================================================
-- ORA Hockey — Fines added by hand
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP), after 041
-- =============================================================
--
-- Every other fine is derived (018). These are the ones the finemaster adds
-- from the Fines tab: a player, a reason and an amount in cents. They're
-- waived and paid like the rest, so fine_waivers / fine_payments (018/019)
-- accept item_type 'manual' + reason 'manual' (item_id = manual_fines.id).
-- Finemasters and the superadmin only (can_manage_fines(), 035).
--
-- Additive: older app code never reads the table or writes 'manual'.
-- Re-run safe.
-- =============================================================

create table if not exists public.manual_fines (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  reason        text not null check (char_length(btrim(reason)) between 1 and 200),
  amount_cents  integer not null check (amount_cents between 1 and 100000),
  fined_at      timestamptz not null default now(),
  created_by    uuid references public.players(id) on delete set null
);

alter table public.manual_fines enable row level security;
drop policy if exists "Signed-in users can view manual_fines" on public.manual_fines;
create policy "Signed-in users can view manual_fines" on public.manual_fines
  for select using (auth.role() = 'authenticated');
drop policy if exists "Fine managers manage manual_fines" on public.manual_fines;
create policy "Fine managers manage manual_fines" on public.manual_fines
  for all using (can_manage_fines()) with check (can_manage_fines());

alter table public.fine_waivers drop constraint if exists fine_waivers_item_type_check;
alter table public.fine_waivers add constraint fine_waivers_item_type_check
  check (item_type in ('game', 'training', 'event', 'poll', 'manual'));
alter table public.fine_waivers drop constraint if exists fine_waivers_reason_check;
alter table public.fine_waivers add constraint fine_waivers_reason_check
  check (reason in ('late_reply', 'late_change', 'manual'));

alter table public.fine_payments drop constraint if exists fine_payments_item_type_check;
alter table public.fine_payments add constraint fine_payments_item_type_check
  check (item_type in ('game', 'training', 'event', 'poll', 'manual'));
alter table public.fine_payments drop constraint if exists fine_payments_reason_check;
alter table public.fine_payments add constraint fine_payments_reason_check
  check (reason in ('late_reply', 'late_change', 'manual'));
