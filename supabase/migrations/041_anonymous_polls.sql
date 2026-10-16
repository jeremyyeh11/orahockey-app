-- =============================================================
-- ORA Hockey — anonymous and public polls
-- Apply in: Supabase Dashboard → SQL Editor → Run (or via MCP)
-- =============================================================
--
--   polls.anonymous   true  = nobody sees what anyone picked (admins included),
--                             only who has voted and the totals.
--                     false = everyone sees who picked each option.
--                     Set when the poll is created and fixed after that, so a
--                     vote cast in secret is never made public.
--   poll_votes        readable row by row only for your own picks and for
--                     public polls.
--   poll_voters()     who voted on each poll and when (their earliest current
--                     vote) — no picks. Feeds the voter list and fines.
--   poll_tallies()    votes per option, for every poll.
--
-- Existing polls stay anonymous (the app never showed picks). Re-run safe.
-- =============================================================

alter table public.polls add column if not exists anonymous boolean not null default true;

create or replace function public.guard_poll_anonymous()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.anonymous is distinct from old.anonymous then
    raise exception 'A poll can''t switch between anonymous and public after it''s created';
  end if;
  return new;
end;
$$;

drop trigger if exists polls_guard_anonymous on public.polls;
create trigger polls_guard_anonymous before update on public.polls
  for each row execute function public.guard_poll_anonymous();

-- ── Who can read picks ───────────────────────────────────────
-- Admins lose their blanket read; their writes stay (votes go through
-- set_poll_vote, and deleting a poll cascades).

drop policy if exists "Admins have full access to poll_votes" on public.poll_votes;
drop policy if exists "Admins can insert poll_votes" on public.poll_votes;
drop policy if exists "Admins can update poll_votes" on public.poll_votes;
drop policy if exists "Admins can delete poll_votes" on public.poll_votes;
create policy "Admins can insert poll_votes" on public.poll_votes for insert with check (is_admin());
create policy "Admins can update poll_votes" on public.poll_votes for update using (is_admin()) with check (is_admin());
create policy "Admins can delete poll_votes" on public.poll_votes for delete using (is_admin());

drop policy if exists "Players can view poll_votes" on public.poll_votes;
drop policy if exists "Read own picks and public polls" on public.poll_votes;
create policy "Read own picks and public polls" on public.poll_votes for select to authenticated using (
  player_id = (select id from public.players where auth_user_id = auth.uid())
  or exists (select 1 from public.polls p where p.id = poll_id and not p.anonymous)
);

-- ── Who voted, and totals, without the picks ─────────────────

create or replace function public.poll_voters()
returns table (poll_id uuid, player_id uuid, voted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.poll_id, v.player_id, min(v.voted_at)
  from poll_votes v
  group by v.poll_id, v.player_id
$$;

create or replace function public.poll_tallies()
returns table (poll_id uuid, poll_option_id uuid, votes integer)
language sql stable security definer set search_path = public as $$
  select v.poll_id, v.poll_option_id, count(*)::integer
  from poll_votes v
  group by v.poll_id, v.poll_option_id
$$;

revoke execute on function public.poll_voters() from public, anon;
revoke execute on function public.poll_tallies() from public, anon;
grant  execute on function public.poll_voters() to authenticated;
grant  execute on function public.poll_tallies() to authenticated;
