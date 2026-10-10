-- =============================================================
-- ORA Hockey — optional reason when a player is out
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   attendance.reason  why they're out ("Work trip"), up to 200 characters.
--                      Optional, visible to the whole squad. Only kept while
--                      the answer is Out: any other answer clears it.
--
-- Saving a reason doesn't change the status, so it never moves responded_at
-- or adds an attendance_log row (018) — it can't cause a late-change fine.
--
-- Re-run safe.
-- =============================================================

alter table public.attendance add column if not exists reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_reason_length') then
    alter table public.attendance
      add constraint attendance_reason_length check (char_length(reason) <= 200);
  end if;
end;
$$;

create or replace function public.clear_attendance_reason()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> 'not_attending' then
    new.reason := null;
  else
    new.reason := nullif(btrim(new.reason), '');
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_clear_reason on public.attendance;
create trigger attendance_clear_reason before insert or update on public.attendance
  for each row execute function public.clear_attendance_reason();
