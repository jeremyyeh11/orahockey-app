-- =============================================================
-- ORA Hockey — Telegram-style polls: multiple answers, tap to vote, retract
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   polls.multiple_choice  false = pick one option; true = pick any number.
--   poll_votes             one row per player per picked option (was one
--                          row per player).
--   set_poll_vote()        the only way players vote: sets their picks on an
--                          open poll to exactly the given options. An empty
--                          list retracts. Switching / adding options keeps the
--                          time they first voted; a full retract drops it, so
--                          a re-vote after the respond-by is a late reply
--                          (lib/fines.ts uses the earliest current vote).
--
-- Re-run safe.
-- =============================================================

alter table public.polls add column if not exists multiple_choice boolean not null default false;

-- ── One row per picked option ────────────────────────────────

alter table public.poll_votes drop constraint if exists poll_votes_poll_id_player_id_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'poll_votes_poll_player_option_key') then
    alter table public.poll_votes
      add constraint poll_votes_poll_player_option_key unique (poll_id, player_id, poll_option_id);
  end if;
end;
$$;

-- ── Vote time: when the player started holding a vote ────────
-- A new pick inherits the player's earliest current vote on the poll; edits
-- never move it.
create or replace function public.stamp_poll_vote()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.voted_at := old.voted_at;
    return new;
  end if;
  select min(voted_at) into new.voted_at
    from poll_votes where poll_id = new.poll_id and player_id = new.player_id;
  new.voted_at := coalesce(new.voted_at, now());
  return new;
end;
$$;

drop trigger if exists poll_votes_stamp on public.poll_votes;
create trigger poll_votes_stamp before insert or update on public.poll_votes
  for each row execute function public.stamp_poll_vote();

-- ── Voting ───────────────────────────────────────────────────

create or replace function public.set_poll_vote(p_poll_id uuid, p_option_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_player uuid;
  v_poll   polls%rowtype;
  v_ids    uuid[] := coalesce((select array_agg(distinct x) from unnest(p_option_ids) x), '{}');
begin
  select id into v_player from players where auth_user_id = auth.uid();
  if v_player is null then
    raise exception 'No player record linked to this account';
  end if;

  select * into v_poll from polls where id = p_poll_id;
  if not found then
    raise exception 'Poll not found';
  end if;
  if not v_poll.is_active or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'This poll is closed';
  end if;
  if not v_poll.multiple_choice and cardinality(v_ids) > 1 then
    raise exception 'This poll takes one answer';
  end if;
  if exists (
    select 1 from unnest(v_ids) x
    where not exists (select 1 from poll_options o where o.id = x and o.poll_id = p_poll_id)
  ) then
    raise exception 'That option isn''t in this poll';
  end if;

  -- Add before removing, so a switched pick inherits the original vote time
  insert into poll_votes (poll_id, poll_option_id, player_id)
    select p_poll_id, x, v_player from unnest(v_ids) x
    on conflict (poll_id, player_id, poll_option_id) do nothing;
  delete from poll_votes
    where poll_id = p_poll_id and player_id = v_player and poll_option_id <> all (v_ids);
end;
$$;

revoke execute on function public.set_poll_vote(uuid, uuid[]) from public, anon;
grant  execute on function public.set_poll_vote(uuid, uuid[]) to authenticated;

-- Players vote only through set_poll_vote (it checks the poll is open and the
-- single-answer rule); admins keep full access.
drop policy if exists "Players can insert own vote" on public.poll_votes;
