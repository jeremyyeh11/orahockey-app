// Pure stat computation — no React, no 'use client'.
// Shared between server pages and client components.

export type PlayerLite = {
  id: string
  full_name: string
  preferred_name: string | null
  jersey_number: number | null
}

export type GameLite = {
  id: string
  game_date: string
  result: string | null
}

export type SeasonStat = {
  player_id: string
  game_id: string
  goals_fg: number
  goals_pc: number
  goals_ps: number
  assists: number
  clean_sheet: boolean
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

/** Distinct season labels (years) from game dates, newest first. */
export function seasonsOf(games: GameLite[]): string[] {
  const years = new Set(games.map((g) => String(new Date(g.game_date).getFullYear())))
  return Array.from(years).sort((a, b) => b.localeCompare(a))
}

export function computeSeason({
  players,
  games,
  stats,
  potm,
  attendance,
  season,
}: {
  players: PlayerLite[]
  games: GameLite[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  season: string
}) {
  const seasonGames = season === 'all'
    ? games
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
    if (s.clean_sheet) r.cleanSheets += 1
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

  // Real card data — keyed by short name, matched case-insensitively
  const CARD_DATA: Record<string, { green: number; yellow: number; red: number }> = {
    'Akash':      { green: 0, yellow: 0, red: 0 },
    'Alton':      { green: 0, yellow: 0, red: 0 },
    'Ashwin':     { green: 0, yellow: 0, red: 0 },
    'Balraj':     { green: 0, yellow: 0, red: 0 },
    'Boon Kai':   { green: 0, yellow: 0, red: 0 },
    'Faris':      { green: 0, yellow: 0, red: 0 },
    'Gabriel':    { green: 0, yellow: 0, red: 0 },
    'Hafiz':      { green: 0, yellow: 0, red: 0 },
    'Hiren':      { green: 2, yellow: 0, red: 0 },
    'Ian':        { green: 0, yellow: 0, red: 0 },
    'Ish':        { green: 0, yellow: 1, red: 0 },
    'Jasmeet':    { green: 1, yellow: 0, red: 0 },
    'Jaspal':     { green: 1, yellow: 0, red: 0 },
    'Jaydon':     { green: 0, yellow: 1, red: 0 },
    'Jeremy':     { green: 1, yellow: 0, red: 0 },
    'Joash':      { green: 0, yellow: 0, red: 0 },
    'Jorim':      { green: 1, yellow: 0, red: 0 },
    'Joshua':     { green: 0, yellow: 0, red: 0 },
    'Kang':       { green: 0, yellow: 0, red: 0 },
    'Kevin Saji': { green: 0, yellow: 0, red: 0 },
    'Matteus':    { green: 0, yellow: 0, red: 0 },
    'Peh Yu':     { green: 1, yellow: 0, red: 0 },
    'Raziq':      { green: 0, yellow: 0, red: 0 },
    'Rifqi':      { green: 1, yellow: 0, red: 0 },
    'Ryan Naidu': { green: 0, yellow: 0, red: 0 },
    'Ryan Vir':   { green: 1, yellow: 0, red: 0 },
  }

  const EMPTY_CARDS = { green: 0, yellow: 0, red: 0 }
  for (const id of Object.keys(rows)) {
    const r = rows[id]
    const player = players.find((p) => p.id === id)
    if (!player) {
      r.cards = EMPTY_CARDS
      continue
    }
    const fullNameUpper = player.full_name.toUpperCase()
    const sortedCards = Object.entries(CARD_DATA).sort((a, b) => b[0].length - a[0].length)
    const match = sortedCards.find(([key]) =>
      fullNameUpper.includes(key.toUpperCase())
    )
    r.cards = match ? match[1] : EMPTY_CARDS
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

  const topScorers = Object.values(rows)
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)

  const topScorerGroups: LeaderboardRow[][] = []
  for (const r of topScorers) {
    const last = topScorerGroups[topScorerGroups.length - 1]
    if (last && last[0].goals === r.goals) {
      last.push(r)
    } else {
      if (topScorerGroups.length >= 3) break
      topScorerGroups.push([r])
    }
  }

  return { seasonGames, leaderboard, pots, topScorerGroups }
}
