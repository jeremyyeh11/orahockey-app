// Pure stat computation — no React, no 'use client'.
// Shared between server pages and client components.

export type PlayerLite = {
  id: string
  full_name: string
  preferred_name: string | null
  jersey_number: number | null
  position?: string[] | null
}

export type GameLite = {
  id: string
  game_date: string
  result: string | null
  goals_against: number | null
  season_id?: string
}

export type SeasonStat = {
  player_id: string
  game_id: string
  goals_fg: number
  goals_pc: number
  goals_ps: number
  assists: number
}

export type PotmRow = {
  game_id: string
  player_id: string
  place: number
}

export type AttendanceRow = {
  player_id: string
  session_id: string
}

export type MatchCardRow = {
  player_id: string
  game_id: string | null
  card_type: 'green' | 'yellow' | 'red'
  created_at: string
}

export type LeaderboardRow = {
  player: PlayerLite
  goals: number
  fg: number
  pc: number
  ps: number
  assists: number
  cleanSheets: number
  potmWins: number
  potsPts: number
  caps: number
  cards: { green: number; yellow: number; red: number }
}

const POTM_POINTS: Record<number, number> = { 1: 3, 2: 2, 3: 1 }

/**
 * Season stats from raw rows. `season` is a season label (e.g. '2026') or 'all'
 * for career totals. Pass `seasonId` to pick games by their season_id; without
 * it, games are matched on the year of their date.
 */
export function computeSeason({
  players,
  games,
  stats,
  potm,
  attendance,
  cards = [],
  season,
  seasonId,
}: {
  players: PlayerLite[]
  games: GameLite[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  cards?: MatchCardRow[]
  season: string
  seasonId?: string
}) {
  const seasonGames = season === 'all'
    ? games
    : seasonId
    ? games.filter((g) => g.season_id === seasonId)
    : games.filter((g) => String(new Date(g.game_date).getFullYear()) === season)
  const gameIds = new Set(seasonGames.map((g) => g.id))
  const playedIds = new Set(seasonGames.filter((g) => g.result).map((g) => g.id))

  const rows: Record<string, LeaderboardRow> = {}
  const rowFor = (id: string) => {
    const player = players.find((p) => p.id === id)
    if (!player) return null
    return (rows[id] ??= {
      player,
      goals: 0,
      fg: 0,
      pc: 0,
      ps: 0,
      assists: 0,
      cleanSheets: 0,
      potmWins: 0,
      potsPts: 0,
      caps: 0,
      cards: { green: 0, yellow: 0, red: 0 },
    })
  }

  for (const s of stats) {
    if (!gameIds.has(s.game_id)) continue
    const r = rowFor(s.player_id)
    if (!r) continue
    r.fg += s.goals_fg
    r.pc += s.goals_pc
    r.ps += s.goals_ps
    r.goals += s.goals_fg + s.goals_pc + s.goals_ps
    r.assists += s.assists
  }

  for (const m of potm) {
    if (!gameIds.has(m.game_id)) continue
    const r = rowFor(m.player_id)
    if (!r) continue
    if (m.place === 1) r.potmWins += 1
    r.potsPts += POTM_POINTS[m.place] ?? 0
  }

  for (const a of attendance) {
    if (!playedIds.has(a.session_id)) continue
    const r = rowFor(a.player_id)
    if (r) r.caps += 1
  }

  // Clean sheets — derived, never stored: a GK who attended a played game
  // in which we conceded nothing gets a CS.
  const shutoutIds = new Set(
    seasonGames.filter((g) => g.result && g.goals_against === 0).map((g) => g.id)
  )
  const gkIds = new Set(
    players.filter((p) => p.position?.includes('GK')).map((p) => p.id)
  )
  for (const a of attendance) {
    if (!shutoutIds.has(a.session_id) || !gkIds.has(a.player_id)) continue
    const r = rowFor(a.player_id)
    if (r) r.cleanSheets += 1
  }

  // Cards from match_cards rows. Rows with a game follow that game's season;
  // legacy rows (game_id null, no match attribution) follow their created_at year.
  for (const c of cards) {
    const inSeason = c.game_id
      ? gameIds.has(c.game_id)
      : season === 'all' || String(new Date(c.created_at).getFullYear()) === season
    if (!inSeason) continue
    const r = rowFor(c.player_id)
    if (r) r.cards[c.card_type] += 1
  }

  const leaderboard = Object.values(rows)
    .filter((r) => r.goals > 0 || r.assists > 0 || r.cleanSheets > 0 || r.potsPts > 0 || r.caps > 0)
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        b.assists - a.assists ||
        b.cleanSheets - a.cleanSheets ||
        b.caps - a.caps
    )

  const pots = Object.values(rows)
    .filter((r) => r.potsPts > 0)
    .sort((a, b) => b.potsPts - a.potsPts || b.potmWins - a.potmWins || b.goals - a.goals)
    .slice(0, 3)

  const topScorerGroups = rankedGroups(Object.values(rows), (r) => r.goals, (r) => r.assists)
  const topAssistGroups = rankedGroups(Object.values(rows), (r) => r.assists, (r) => r.goals)

  return { seasonGames, leaderboard, pots, topScorerGroups, topAssistGroups }
}

/**
 * Leaderboard groups for one stat (players tied on it share a group), for the
 * Top Scorers / Top Assists cards. Standard competition ranking (1, 1, 3, …): a
 * group ranks 1 + the number of players ahead of it. Groups are added until one
 * ranked 5th or lower is shown — so a tie across 4th/5th (1, 1, 3, 4, 4) still
 * carries on to the next group (6) rather than stopping short of number 5.
 */
export function rankedGroups(
  rows: LeaderboardRow[],
  value: (r: LeaderboardRow) => number,
  tiebreak: (r: LeaderboardRow) => number,
): LeaderboardRow[][] {
  const sorted = rows
    .filter((r) => value(r) > 0)
    .sort((a, b) => value(b) - value(a) || tiebreak(b) - tiebreak(a))

  const groups: LeaderboardRow[][] = []
  let listed = 0
  let lastRank = 0
  for (const r of sorted) {
    const last = groups[groups.length - 1]
    if (last && value(last[0]) === value(r)) {
      last.push(r)
    } else {
      if (lastRank >= 5) break
      lastRank = listed + 1
      groups.push([r])
    }
    listed++
  }
  return groups
}
