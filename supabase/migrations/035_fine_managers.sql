-- =============================================================
-- ORA Hockey — only finemasters and the superadmin manage fines
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP), after 034
-- =============================================================
--
-- Waiving (fine_waivers, 018) and marking paid (fine_payments, 019) move from
-- admins to can_manage_fines() (034): finemasters and the superadmin. Jeremy
-- becomes the first superadmin, so he keeps that power.
--
-- Apply only once the app that knows these roles is deployed: older code
-- sends a superadmin to the player area and shows admins waive buttons.
--
-- Re-run safe.
-- =============================================================

drop policy if exists "Admins manage fine_waivers" on public.fine_waivers;
drop policy if exists "Fine managers manage fine_waivers" on public.fine_waivers;
create policy "Fine managers manage fine_waivers" on public.fine_waivers
  for all using (can_manage_fines()) with check (can_manage_fines());

drop policy if exists "Admins manage fine_payments" on public.fine_payments;
drop policy if exists "Fine managers manage fine_payments" on public.fine_payments;
create policy "Fine managers manage fine_payments" on public.fine_payments
  for all using (can_manage_fines()) with check (can_manage_fines());

update public.players set role = 'superadmin' where email = 'jeremyyeh11@gmail.com';
