import { createClient } from '@/lib/supabase/server'

// Vote-POTM data for the Polls tab (backlog #5). One poll per played match with a
// published team list. Candidates and eligible voters are that same team list; the
// ranked ballots are secret, so the client only ever receives *who* has voted
// (voterIds) — never their choices — plus the derived placings once a poll closes.

export type PotmCandidate = {
  id: string
  full_name: string
  preferred_name: string | null
  jersey_number: number | null
}

export type PotmPoll = {
  id: string
  game_id: string
  status: 'open' | 'closed'
  opponent: string
  game_date: string
  candidates: PotmCandidate[] // = eligible voters (the published team list)
  voterIds: string[] // players who have voted (public receipt)
  result: { player_id: string; place: number }[] // placings, only when closed
}

type PollRow = {
  id: string
  game_id: string
  status: 'open' | 'closed'
  games: { opponent: string; game_date: string } | null
}

/**
 * Ensure polls exist for any newly-played published matches, then load every POTM
 * poll with its candidates, who-has-voted receipts, and (for closed polls) results.
 * Returns the caller's player id so the client can resolve eligibility / self-tag.
 */
export async function getPotmPolls(): Promise<{ polls: PotmPoll[]; myPlayerId: string | null }> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  // Lazily create polls for played matches with a published team list (no scheduler).
  await supabase.rpc('ensure_potm_polls')

  const { data: pollRows } = await supabase
    .from('potm_polls')
    .select('id, game_id, status, games(opponent, game_date)')
    .order('created_at', { ascending: false })

  const polls = (pollRows ?? []) as unknown as PollRow[]
  if (polls.length === 0) return { polls: [], myPlayerId: me?.id ?? null }

  const gameIds = polls.map((p) => p.game_id)
  const pollIds = polls.map((p) => p.id)
  const closedGameIds = polls.filter((p) => p.status === 'closed').map((p) => p.game_id)

  const [{ data: listRows }, { data: ballotRows }, { data: resultRows }] = await Promise.all([
    supabase
      .from('match_team_lists')
      .select('game_id, players(id, full_name, preferred_name, jersey_number)')
      .in('game_id', gameIds),
    supabase.from('potm_ballots').select('poll_id, voter_id').in('poll_id', pollIds),
    closedGameIds.length
      ? supabase.from('potm').select('game_id, player_id, place').in('game_id', closedGameIds)
      : Promise.resolve({ data: [] as { game_id: string; player_id: string; place: number }[] }),
  ])

  const candidatesByGame = new Map<string, PotmCandidate[]>()
  for (const row of (listRows ?? []) as unknown as {
    game_id: string
    players: PotmCandidate | null
  }[]) {
    if (!row.players) continue
    const arr = candidatesByGame.get(row.game_id) ?? []
    arr.push(row.players)
    candidatesByGame.set(row.game_id, arr)
  }

  const votersByPoll = new Map<string, string[]>()
  for (const b of (ballotRows ?? []) as { poll_id: string; voter_id: string }[]) {
    const arr = votersByPoll.get(b.poll_id) ?? []
    arr.push(b.voter_id)
    votersByPoll.set(b.poll_id, arr)
  }

  const resultByGame = new Map<string, { player_id: string; place: number }[]>()
  for (const r of (resultRows ?? []) as { game_id: string; player_id: string; place: number }[]) {
    const arr = resultByGame.get(r.game_id) ?? []
    arr.push({ player_id: r.player_id, place: r.place })
    resultByGame.set(r.game_id, arr)
  }

  const shaped: PotmPoll[] = polls.map((p) => ({
    id: p.id,
    game_id: p.game_id,
    status: p.status,
    opponent: p.games?.opponent ?? 'Unknown',
    game_date: p.games?.game_date ?? '',
    candidates: (candidatesByGame.get(p.game_id) ?? []).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    ),
    voterIds: votersByPoll.get(p.id) ?? [],
    result: resultByGame.get(p.game_id) ?? [],
  }))

  return { polls: shaped, myPlayerId: me?.id ?? null }
}
