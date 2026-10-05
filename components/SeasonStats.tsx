'use client'

import { useState } from 'react'
import { preferredName } from './RosterList'
import { LEAGUE } from '@/lib/constants'

// Re-export types and pure functions from lib/stats.ts so existing imports work
export type { PlayerLite, GameLite, SeasonStat, PotmRow, AttendanceRow, MatchCardRow, LeaderboardRow } from '@/lib/stats'

import { computeSeason, seasonsOf } from '@/lib/stats'
export { computeSeason, seasonsOf }
import type {
  PlayerLite,
  GameLite,
  SeasonStat,
  PotmRow,
  AttendanceRow,
  MatchCardRow,
  LeaderboardRow,
} from '@/lib/stats'

/**
 * Season selection + leaderboard computation for the squad screens. Owns the
 * selected-season state (defaulting to the most recent season), runs
 * computeSeason, and exposes the id→row map the roster needs. Shared by the
 * admin and player SquadClients, which differ only in how they filter the
 * roster and whether they can edit it.
 */
export function useSeasonStats({
  players,
  games,
  stats,
  potm,
  attendance,
  cards,
}: {
  players: PlayerLite[]
  games: GameLite[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  cards: MatchCardRow[]
}) {
  const seasons = seasonsOf(games)
  const [season, setSeason] = useState<string>(seasons[0] ?? String(new Date().getFullYear()))

  const { seasonGames, leaderboard, pots, topScorerGroups } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    cards,
    season,
  })

  const statsMap = new Map<string, LeaderboardRow>(leaderboard.map((r) => [r.player.id, r]))

  return { seasons, season, setSeason, seasonGames, leaderboard, pots, topScorerGroups, statsMap }
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
      aria-label="Season"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="liga-season-select liga-button min-h-[44px] max-w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {seasons.map((s) => (
        <option key={s} value={s}>
          {LEAGUE} {s}
        </option>
      ))}
    </select>
  )
}

export function PotsCard({ pots }: { pots: LeaderboardRow[] }) {
  if (pots.length === 0) return null
  return (
    <div className="liga-panel card overflow-hidden">
      <h2 className="liga-panel-heading border-b border-white/10 px-3 py-2 text-xs font-medium text-slate-400">
        POTS Race
      </h2>
      {pots.map((r, i) => (
        <div
          key={r.player.id}
          className="liga-panel-row flex items-baseline gap-2 border-b border-white/5 px-3 py-2 last:border-0"
        >
          <span className="liga-rank liga-meta w-5 shrink-0 text-center text-xs tabular-nums">{i + 1}</span>
          <span className="liga-panel-name min-w-0 flex-1 break-words text-xs font-medium text-white">
            {preferredName(r.player)}
          </span>
          <span className="liga-panel-value shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-brand-light">{r.potsPts} pts</span>
        </div>
      ))}
    </div>
  )
}

export function TopScorersCard({ groups }: { groups: LeaderboardRow[][] }) {
  if (groups.length === 0) return null
  // One row per player; tied players share their group's rank (1, 1, 3, …)
  let ahead = 0
  const rows = groups.flatMap((grp) => {
    const rank = ahead + 1
    ahead += grp.length
    return grp.map((r) => ({ r, rank }))
  })
  return (
    <div className="liga-panel card overflow-hidden">
      <h2 className="liga-panel-heading border-b border-white/10 px-3 py-2 text-xs font-medium text-slate-400">
        Top Scorers
      </h2>
      {rows.map(({ r, rank }) => (
        <div
          key={r.player.id}
          className="liga-panel-row flex items-baseline gap-2 border-b border-white/5 px-3 py-2 last:border-0"
        >
          <span className="liga-rank liga-meta w-5 shrink-0 text-center text-xs tabular-nums">{rank}</span>
          <span className="liga-panel-name min-w-0 flex-1 break-words text-xs font-medium text-white">
            {preferredName(r.player)}
          </span>
          <span className="liga-panel-value shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-brand-light">{r.goals}</span>
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
    <div className="liga-panel card overflow-hidden">
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
            <th className="py-2.5 pl-1.5 pr-4 text-center font-medium">App</th>
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
