'use client'

import { useState } from 'react'
import RosterList from '@/components/RosterList'
import {
  computeSeason,
  seasonsOf,
  SeasonSelect,
  PotsCard,
  TopScorersCard,
  type PlayerLite,
  type GameLite,
  type SeasonStat,
  type PotmRow,
  type AttendanceRow,
} from '@/components/SeasonStats'
import type { RosterPlayer } from '@/components/RosterList'

type Player = RosterPlayer & PlayerLite

export default function SquadClient({
  players,
  games,
  stats,
  potm,
  attendance,
  myPlayerId,
}: {
  players: Player[]
  games: GameLite[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  myPlayerId: string | null
}) {
  const seasons = seasonsOf(games)
  const [season, setSeason] = useState<string>(
    seasons[0] ?? String(new Date().getFullYear())
  )

  const { seasonGames, leaderboard, pots, topScorerGroups } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    season,
  })

  // Build a stats lookup map for inline display
  const statsMap = new Map(leaderboard.map((r) => [r.player.id, r]))

  // Filter roster to players active for the selected season:
  // - has stats/potm/attendance for games in that season, OR
  // - is currently active (for the current season)
  const currentYear = String(new Date().getFullYear())
  const seasonGameIds = new Set(seasonGames.map((g) => g.id))
  const playedIds = new Set(
    seasonGames.filter((g) => g.result).map((g) => g.id)
  )

  const seasonPlayerIds = new Set<string>()
  for (const s of stats) {
    if (seasonGameIds.has(s.game_id)) seasonPlayerIds.add(s.player_id)
  }
  for (const m of potm) {
    if (seasonGameIds.has(m.game_id)) seasonPlayerIds.add(m.player_id)
  }
  for (const a of attendance) {
    if (playedIds.has(a.session_id)) seasonPlayerIds.add(a.player_id)
  }

  const visible =
    season === currentYear
      ? players.filter((p) => p.is_active)
      : players.filter(
          (p) => seasonPlayerIds.has(p.id) || p.is_active
        )

  return (
    <div className="p-4">
      {/* Header + season selector */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Squad</h1>
          <p className="text-sm text-slate-400">{visible.length} players</p>
        </div>
        <SeasonSelect seasons={seasons} value={season} onChange={setSeason} />
      </div>

      {/* POTS race + Top scorers — side by side */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <PotsCard pots={pots} />
        <TopScorersCard groups={topScorerGroups} />
      </div>

      {/* Roster with inline stats */}
      <RosterList
        players={visible}
        myPlayerId={myPlayerId}
        statsMap={statsMap}
      />
    </div>
  )
}
