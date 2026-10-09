'use client'

import { preferredName } from './RosterList'

// Re-export types and pure functions from lib/stats.ts so existing imports work
export type { PlayerLite, GameLite, SeasonStat, PotmRow, AttendanceRow, MatchCardRow, LeaderboardRow } from '@/lib/stats'

import { computeSeason } from '@/lib/stats'
export { computeSeason }
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
 * Leaderboard computation for the squad screens: runs computeSeason for the
 * season picked in the app's season switcher and exposes the id→row map the
 * roster needs. Shared by the admin and player SquadClients, which differ only
 * in how they filter the roster and whether they can edit it.
 */
export function useSeasonStats({
  season,
  players,
  games,
  stats,
  potm,
  attendance,
  cards,
}: {
  /** The selected season; `allTime` → career totals across every season */
  season: { id: string; label: string; allTime?: boolean }
  players: PlayerLite[]
  games: GameLite[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  cards: MatchCardRow[]
}) {
  const { seasonGames, leaderboard, topScorerGroups, topAssistGroups } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    cards,
    season: season.allTime ? 'all' : season.label,
    seasonId: season.allTime ? undefined : season.id,
  })

  const statsMap = new Map<string, LeaderboardRow>(leaderboard.map((r) => [r.player.id, r]))

  return { seasonGames, leaderboard, topScorerGroups, topAssistGroups, statsMap }
}

export function TopScorersCard({ groups }: { groups: LeaderboardRow[][] }) {
  return <RankedCard title="Top Scorers" groups={groups} value={(r) => r.goals} />
}

export function TopAssistsCard({ groups }: { groups: LeaderboardRow[][] }) {
  return <RankedCard title="Top Assists" groups={groups} value={(r) => r.assists} />
}

function RankedCard({
  title,
  groups,
  value,
}: {
  title: string
  groups: LeaderboardRow[][]
  value: (r: LeaderboardRow) => number
}) {
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
        {title}
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
          <span className="liga-panel-value shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-brand-light">{value(r)}</span>
        </div>
      ))}
    </div>
  )
}
