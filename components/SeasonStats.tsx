'use client'

// Shared season-scoped stats: season picker, POTS race card, leaderboard.
// POTM points (3/2/1 for 1st/2nd/3rd) are derived here, never stored.

export type PlayerLite = {
  id: string
  full_name: string
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
  const seasonGames = games.filter((g) => String(new Date(g.game_date).getFullYear()) === season)
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

  // Caps = games played, derived from attendance on played games
  // (placeholder numbers until attendance is tracked for real)
  for (const a of attendance) {
    if (!playedIds.has(a.session_id)) continue
    const r = rowFor(a.player_id)
    if (r) r.caps += 1
  }

  // Real card data (green/yellow/red) — hardcoded from 2026 season totals
  const CARD_DATA: Record<string, { green: number; yellow: number; red: number }> = {
    'Akash':      { green: 0, yellow: 0, red: 0 },
    'Alton':      { green: 0, yellow: 0, red: 0 },
    'Ashwin':     { green: 0, yellow: 0, red: 0 },
    'Balraj':     { green: 0, yellow: 0, red: 0 },
    'Boon Kai':   { green: 0, yellow: 0, red: 0 },
    'Faris':      { green: 0, yellow: 0, red: 0 },
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

  for (const id of Object.keys(rows)) {
    const r = rows[id]
    const player = players.find((p) => p.id === id)
    r.cards = player ? (CARD_DATA[player.full_name] ?? { green: 0, yellow: 0, red: 0 }) : { green: 0, yellow: 0, red: 0 }
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

  return { seasonGames, leaderboard, pots }
}

export function SeasonSelect({
  seasons,
  value,
  onChange,
}: {
  seasons: string[]
  value: string
  onChange: (s: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {seasons.map((s) => (
        <option key={s} value={s}>
          Season {s}
        </option>
      ))}
    </select>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

export function PotsCard({ pots }: { pots: LeaderboardRow[] }) {
  if (pots.length === 0) return null
  return (
    <div className="card mb-4 overflow-hidden">
      <div className="border-b border-white/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Player of the Season race
      </div>
      {pots.map((r, i) => (
        <div
          key={r.player.id}
          className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0"
        >
          <span className="w-6 text-center text-base">{MEDALS[i]}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {r.player.full_name}
          </span>
          <span className="shrink-0 text-sm font-semibold text-brand-light">{r.potsPts} pts</span>
        </div>
      ))}
    </div>
  )
}

export function LeaderboardTable({
  rows,
  highlightId,
}: {
  rows: LeaderboardRow[]
  highlightId?: string | null
}) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="py-6 text-center text-sm text-slate-500">No stats recorded yet.</p>
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
            <th className="px-2 py-2.5 font-medium">Player</th>
            <th className="px-1.5 py-2.5 text-center font-medium">FG</th>
            <th className="px-1.5 py-2.5 text-center font-medium">PC</th>
            <th className="px-1.5 py-2.5 text-center font-medium">PS</th>
            <th className="px-1.5 py-2.5 text-center font-medium">A</th>
            <th className="px-1.5 py-2.5 text-center font-medium">CS</th>
            <th className="px-1.5 py-2.5 text-center font-medium">POTM</th>
            <th className="py-2.5 pl-1.5 pr-4 text-center font-medium">Caps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.player.id}
              className={`border-b border-white/5 last:border-0 ${
                highlightId && row.player.id === highlightId ? 'bg-brand/10' : ''
              }`}
            >
              <td className="py-2.5 pl-4 pr-2 text-slate-500">{i + 1}</td>
              <td className="max-w-0 truncate px-2 py-2.5">
                <div className="truncate font-medium text-white">{row.player.full_name}</div>
              </td>
              <td className="px-1.5 py-2.5 text-center font-semibold text-white">
                {row.fg > 0 ? row.fg : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.pc > 0 ? row.pc : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.ps > 0 ? row.ps : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.assists > 0 ? row.assists : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.cleanSheets > 0 ? row.cleanSheets : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.potmWins > 0 ? row.potmWins : '—'}
              </td>
              <td className="py-2.5 pl-1.5 pr-4 text-center text-slate-300">{row.caps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
