'use client'

import { useState } from 'react'
import { fmtDate } from '@/lib/format'
import {
  computeSeason,
  seasonsOf,
  SeasonSelect,
  PotsCard,
  LeaderboardTable,
  type PlayerLite,
  type SeasonStat,
  type PotmRow,
  type AttendanceRow,
} from '@/components/SeasonStats'

export type Game = {
  id: string
  opponent: string
  game_date: string
  goals_for: number | null
  goals_against: number | null
  result: string | null
}

export default function StatsClient({
  players,
  games,
  stats,
  potm,
  attendance,
  myPlayerId,
}: {
  players: PlayerLite[]
  games: Game[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  myPlayerId: string | null
}) {
  const seasons = seasonsOf(games)
  const [season, setSeason] = useState<string>(seasons[0] ?? String(new Date().getFullYear()))

  const { seasonGames, leaderboard, pots } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    season,
  })

  const seasonGameIds = new Set(seasonGames.map((g) => g.id))
  const mine = myPlayerId ? leaderboard.find((r) => r.player.id === myPlayerId) : null
  const myGoals = mine?.goals ?? 0
  const myAssists = mine?.assists ?? 0
  const myCaps = mine?.caps ?? 0

  const myGameStats = myPlayerId
    ? stats
        .filter(
          (s) =>
            s.player_id === myPlayerId &&
            seasonGameIds.has(s.game_id) &&
            (s.goals_fg > 0 || s.goals_pc > 0 || s.goals_ps > 0 || s.assists > 0 || s.clean_sheet)
        )
        .map((s) => ({ stat: s, game: games.find((g) => g.id === s.game_id) }))
        .filter((x) => x.game)
        .sort((a, b) => new Date(b.game!.game_date).getTime() - new Date(a.game!.game_date).getTime())
    : []

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Stats</h1>
        <SeasonSelect seasons={seasons} value={season} onChange={setSeason} />
      </div>

      {/* My season */}
      <h2 className="mb-2 text-sm font-semibold text-white">My season</h2>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="card flex flex-col items-center gap-1 p-3.5">
          <div className="font-display text-2xl font-bold leading-none text-white">{myGoals}</div>
          <div className="text-[11px] text-slate-400">Goals</div>
        </div>
        <div className="card flex flex-col items-center gap-1 p-3.5">
          <div className="font-display text-2xl font-bold leading-none text-white">{myAssists}</div>
          <div className="text-[11px] text-slate-400">Assists</div>
        </div>
        <div className="card flex flex-col items-center gap-1 p-3.5">
          <div className="font-display text-2xl font-bold leading-none text-white">{myCaps}</div>
          <div className="text-[11px] text-slate-400">Caps</div>
        </div>
      </div>

      {/* My contributions per game */}
      {myGameStats.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">My games</h2>
          <div className="card mb-6 divide-y divide-white/5">
            {myGameStats.map(({ stat, game }) => (
              <div key={stat.game_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">vs {game!.opponent}</div>
                  <div className="text-xs text-slate-500">{fmtDate(game!.game_date)}</div>
                </div>
                <div className="shrink-0 text-xs text-slate-300">
                  {stat.goals_fg > 0 && <span className="mr-2">FG {stat.goals_fg}</span>}
                  {stat.goals_pc > 0 && <span className="mr-2">PC {stat.goals_pc}</span>}
                  {stat.goals_ps > 0 && <span className="mr-2">PS {stat.goals_ps}</span>}
                  {stat.assists > 0 && <span className="mr-2">A {stat.assists}</span>}
                  {stat.clean_sheet && <span className="text-green-400">CS</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* POTS race + team leaderboard */}
      <h2 className="mb-2 text-sm font-semibold text-white">Team</h2>
      <PotsCard pots={pots} />
      <LeaderboardTable rows={leaderboard} highlightId={myPlayerId} />
    </div>
  )
}
