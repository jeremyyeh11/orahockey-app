-- =============================================================
-- ORA Hockey — Respond-by deadlines, RSVP history and fines
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
-- Fines ($5, collated monthly) for late replies and last-minute changes.
-- Fines themselves are not stored: the app derives them (lib/fines.ts) from
--   respond_by      when replies are due — games, trainings, team events and
--                   polls. The app fills it in from the club rules; null = no
--                   deadline (and no fines).
--   fines_enabled   off for casual entries. Team events start off.
--   attendance_log  every RSVP and status change, stamped with the database's
--                   own clock (attendance keeps only the latest status).
--   poll_votes.voted_at, now also stamped by the database.
--   fine_waivers    an admin waiving one fine (e.g. they PM'd the coaching
--                   committee about a last-minute change).
--
-- Club rules, mirrored by defaultRespondBy() in lib/fines.ts (Singapore time):
--   weekend (Sat/Sun) game or training → Thursday 23:59:59 before
--   weekday training                   → Sunday 23:59:59 before
--   weekday game                       → 72 hours before the start
--   team event / poll                  → 72 hours after posting (no later
--                                        than the start / poll close)
--
-- Re-run safe.
-- =============================================================

alter table public.games             add column if not exists respond_by timestamptz, add column if not exists fines_enabled boolean not null default true;
alter table public.training_sessions add column if not exists respond_by timestamptz, add column if not exists fines_enabled boolean not null default true;
alter table public.team_events       add column if not exists respond_by timestamptz, add column if not exists fines_enabled boolean not null default false;
alter table public.polls             add column if not exists respond_by timestamptz, add column if not exists fines_enabled boolean not null default true;

-- ── RSVP history ─────────────────────────────────────────────

create table if not exists public.attendance_log (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  session_id      uuid not null,
  session_type    public.session_type not null,
  status          public.attendance_status not null,
  -- null on a first reply
  previous_status public.attendance_status,
  changed_at      timestamptz not null default now(),
  -- the signed-in user who made the change (null = backend / backfill)
  changed_by      uuid
);
create index if not exists attendance_log_session on public.attendance_log (session_type, session_id, changed_at);

alter table public.attendance_log enable row level security;
-- Everyone sees everyone's fines, so the history is readable by the whole team.
-- No insert/update/delete policies: only the trigger below writes it.
drop policy if exists "Signed-in users can view attendance_log" on public.attendance_log;
create policy "Signed-in users can view attendance_log" on public.attendance_log
  for select using (auth.role() = 'authenticated');

-- responded_at: the database's time of the latest status change (a client can't
-- backdate it, and re-sending the same status keeps the original time)
create or replace function public.stamp_attendance_response()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.responded_at := now();
  else
    new.responded_at := old.responded_at;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_stamp_response on public.attendance;
create trigger attendance_stamp_response before insert or update on public.attendance
  for each row execute function public.stamp_attendance_response();

create or replace function public.log_attendance_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into attendance_log (player_id, session_id, session_type, status, previous_status, changed_at, changed_by)
    values (
      new.player_id, new.session_id, new.session_type, new.status,
      case when tg_op = 'UPDATE' then old.status end,
      new.responded_at, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_log_change on public.attendance;
create trigger attendance_log_change after insert or update on public.attendance
  for each row execute function public.log_attendance_change();

-- Existing RSVPs: one history row each, at their last response time
insert into public.attendance_log (player_id, session_id, session_type, status, changed_at)
select a.player_id, a.session_id, a.session_type, a.status, a.responded_at
from public.attendance a
where not exists (
  select 1 from public.attendance_log l
  where l.player_id = a.player_id and l.session_id = a.session_id and l.session_type = a.session_type
);

-- Poll votes (one per player, can't be changed): stamp with the database's time
create or replace function public.stamp_poll_vote()
returns trigger language plpgsql set search_path = public as $$
begin
  new.voted_at := now();
  return new;
end;
$$;

drop trigger if exists poll_votes_stamp on public.poll_votes;
create trigger poll_votes_stamp before insert on public.poll_votes
  for each row execute function public.stamp_poll_vote();

-- ── Waivers ──────────────────────────────────────────────────

create table if not exists public.fine_waivers (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  item_type  text not null check (item_type in ('game', 'training', 'event', 'poll')),
  item_id    uuid not null,
  reason     text not null check (reason in ('late_reply', 'late_change')),
  note       text,
  waived_by  uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (player_id, item_type, item_id, reason)
);

alter table public.fine_waivers enable row level security;
drop policy if exists "Signed-in users can view fine_waivers" on public.fine_waivers;
create policy "Signed-in users can view fine_waivers" on public.fine_waivers
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage fine_waivers" on public.fine_waivers;
create policy "Admins manage fine_waivers" on public.fine_waivers
  for all using (is_admin()) with check (is_admin());

-- ── Backfill deadlines for what's still upcoming ────────────
-- Games and trainings get the club rule. Fines stay on only where that deadline
-- is more than a day away: a deadline already past ("posted after its deadline")
-- or due before players could see it in the app gets no fines.

with due as (
  select id,
    case
      when extract(isodow from (session_date at time zone 'Asia/Singapore')) >= 6
        then (((session_date at time zone 'Asia/Singapore')::date
               - (extract(isodow from (session_date at time zone 'Asia/Singapore'))::int - 4))
              + time '23:59:59') at time zone 'Asia/Singapore'
      else (((session_date at time zone 'Asia/Singapore')::date
             - extract(isodow from (session_date at time zone 'Asia/Singapore'))::int)
            + time '23:59:59') at time zone 'Asia/Singapore'
    end as respond_by
  from public.training_sessions
  where respond_by is null and session_date > now()
)
update public.training_sessions t
set respond_by = due.respond_by, fines_enabled = due.respond_by > now() + interval '1 day'
from due where t.id = due.id;

with due as (
  select id,
    case
      when extract(isodow from (game_date at time zone 'Asia/Singapore')) >= 6
        then (((game_date at time zone 'Asia/Singapore')::date
               - (extract(isodow from (game_date at time zone 'Asia/Singapore'))::int - 4))
              + time '23:59:59') at time zone 'Asia/Singapore'
      else game_date - interval '72 hours'
    end as respond_by
  from public.games
  where respond_by is null and game_date > now()
)
update public.games g
set respond_by = due.respond_by, fines_enabled = due.respond_by > now() + interval '1 day'
from due where g.id = due.id;

-- Team events: 72h after posting, no later than the start (fines stay off by default)
update public.team_events
set respond_by = least(created_at + interval '72 hours', event_date)
where respond_by is null and event_date > now();

-- Open polls were posted before fines existed: deadline shown, fines off
update public.polls
set respond_by = least(created_at + interval '72 hours', coalesce(closes_at, created_at + interval '72 hours')),
    fines_enabled = false
where respond_by is null and is_active;
