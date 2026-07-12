'use client'

import { useState, useTransition } from 'react'
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
import { PlayerProfileModal, type ProfilePlayer } from '@/components/PlayerProfileModal'
import { updatePlayer } from '@/app/admin/team/actions'

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

  // Career stats (all games, no season filter)
  const { leaderboard: careerLeaderboard } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    season: 'all',
  })

  // Build stats lookup maps
  const statsMap = new Map(leaderboard.map((r) => [r.player.id, r]))
  const careerMap = new Map(careerLeaderboard.map((r) => [r.player.id, r]))

  // Filter roster to players active for the selected season
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

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave(data: {
    preferred_name: string | null
    jersey_number: number | null
    position: string[] | null
    role: 'player' | 'admin'
  }) {
    if (!selectedPlayer) return
    startTransition(async () => {
      try {
        await updatePlayer(selectedPlayer.id, {
          ...data,
          full_name: selectedPlayer.full_name,
          email: (selectedPlayer as Player & { email?: string }).email ?? '',
        })
        setSelectedPlayer(null)
      } catch (err) {
        console.error(err)
      }
    })
  }

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

      {/* Roster with inline stats — now tappable */}
      <RosterList
        players={visible}
        myPlayerId={myPlayerId}
        onSelect={(p) => setSelectedPlayer(p)}
        statsMap={statsMap}
      />

      {/* Player Profile Modal */}
      {selectedPlayer && (
        <PlayerProfileModal
          player={selectedPlayer as ProfilePlayer}
          seasonRow={statsMap.get(selectedPlayer.id)}
          careerRow={careerMap.get(selectedPlayer.id)}
          seasonLabel={season === 'all' ? 'All Time' : `MHL1 ${season}`}
          isAdmin={false}
          onClose={() => setSelectedPlayer(null)}
          onSave={handleSave}
          isPending={isPending}
        />
      )}
    </div>
  )
}
