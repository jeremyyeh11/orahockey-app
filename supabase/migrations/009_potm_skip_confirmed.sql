-- 009_potm_skip_confirmed.sql
-- Don't open a POTM vote for a match whose Player of the Match is already confirmed.
--
-- Some matches had their placings entered directly into `potm` before the vote system
-- existed (e.g. the Jansenites match). ensure_potm_polls() would still spin up an open
-- poll for them, and if that poll ever closed it would wipe the confirmed placings
-- (close_potm_poll deletes prior `potm` rows for the game). Skip any match that already
-- has confirmed placings so the settled result stands.
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────
-- FUNCTION: skip matches with a confirmed POTM
-- ─────────────────────────────────────────

create or replace function ensure_potm_polls()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into potm_polls (game_id)
  select g.id
  from games g
  where g.game_date <= now()
    and g.team_list_status = 'published'
    and exists (select 1 from match_team_lists m where m.game_id = g.id)
    and not exists (select 1 from potm_polls p where p.game_id = g.id)
    and not exists (select 1 from potm pt where pt.game_id = g.id)
  on conflict (game_id) do nothing;
end;
$$;

-- ─────────────────────────────────────────
-- CLEANUP: drop already-created polls for confirmed matches
-- Only touch polls with no ballots so no real vote is ever destroyed. The delete
-- cascades to potm_votes / potm_ballots but leaves the confirmed `potm` placings intact.
-- ─────────────────────────────────────────

delete from potm_polls p
where exists (select 1 from potm pt where pt.game_id = p.game_id)
  and not exists (select 1 from potm_ballots b where b.poll_id = p.id);
