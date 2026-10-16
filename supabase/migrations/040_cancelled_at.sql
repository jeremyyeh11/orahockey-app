-- =============================================================
-- ORA Hockey — when an event was cancelled / postponed
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   <table>.cancelled_at   when games / training_sessions / team_events left
--                          'scheduled' (038); null while scheduled
--
-- Fines already issued by then stay (a respond-by that had passed, a late
-- change that happened); fines that would fall due after it are never issued
-- (lib/fines.ts computeFines, cancelledAt). Stamped by a trigger, so the app
-- can't backdate it. Postponed → cancelled keeps the first stamp; reinstating
-- clears it, so every fine comes back.
--
-- Re-run safe.
-- =============================================================

alter table public.games add column if not exists cancelled_at timestamptz;
alter table public.training_sessions add column if not exists cancelled_at timestamptz;
alter table public.team_events add column if not exists cancelled_at timestamptz;

create or replace function public.stamp_cancelled_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'scheduled' then
    new.cancelled_at := null;
  elsif tg_op = 'INSERT' or old.status = 'scheduled' then
    new.cancelled_at := now();
  else
    new.cancelled_at := old.cancelled_at;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_cancelled_at on public.games;
create trigger stamp_cancelled_at before insert or update of status, cancelled_at on public.games
  for each row execute function public.stamp_cancelled_at();
drop trigger if exists stamp_cancelled_at on public.training_sessions;
create trigger stamp_cancelled_at before insert or update of status, cancelled_at on public.training_sessions
  for each row execute function public.stamp_cancelled_at();
drop trigger if exists stamp_cancelled_at on public.team_events;
create trigger stamp_cancelled_at before insert or update of status, cancelled_at on public.team_events
  for each row execute function public.stamp_cancelled_at();
