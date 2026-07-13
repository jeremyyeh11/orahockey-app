import { createClient } from '@/lib/supabase/server'
import { PlayerProfilePage } from '@/components/PlayerProfilePage'
import { computeSeason, seasonsOf, type PlayerLite, type GameLite, type SeasonStat, type PotmRow, type AttendanceRow, type LeaderboardRow } from '@/lib/stats'
import type { RosterPlayer } from '@/components/RosterList'
import { getNow } from '@/lib/preview'

export default async function AdminPlayerProfileRoute({
  params,
}: {
  params: { playerId: string }
}) {
  const supabase = createClient()

  const [
    { data: player, error: playerErr },
    { data: games },
    { data: stats },
    { data: potm },
    { data: att },
  ] = await Promise.all([
    supabase
      .from('players')
      .select('id, full_name, preferred_name, jersey_number, position, is_active, email, role')
      .eq('id', params.playerId)
      .single(),
    supabase.from('games').select('id, game_date, result').order('game_date', { ascending: false }),
    supabase.from('player_stats').select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists, clean_sheet'),
    supabase.from('potm').select('game_id, player_id, place'),
    supabase.from('attendance').select('player_id, session_id').eq('session_type', 'game').eq('status', 'attending'),
  ])

  if (playerErr || !player) {
    return <div className="p-4 text-sm text-red-400">Player not found.</div>
  }

  const players: (PlayerLite & RosterPlayer)[] = [player as (PlayerLite & RosterPlayer)]
  const seasons = seasonsOf(games ?? [])
  const currentSeason = seasons[0] ?? String(getNow().getFullYear())

  let seasonRow: LeaderboardRow | undefined
  let careerRow: LeaderboardRow | undefined

  try {
    const { leaderboard: seasonLb } = computeSeason({
      players,
      games: games ?? [],
      stats: stats ?? [],
      potm: potm ?? [],
      attendance: att ?? [],
      season: currentSeason,
    })
    const { leaderboard: careerLb } = computeSeason({
      players,
      games: games ?? [],
      stats: stats ?? [],
      potm: potm ?? [],
      attendance: att ?? [],
      season: 'all',
    })
    seasonRow = seasonLb.find((r) => r.player.id === player.id)
    careerRow = careerLb.find((r) => r.player.id === player.id)
  } catch (e) {
    // computeSeason may crash if data is incomplete — that's fine, just show no stats
  }

  return (
    <PlayerProfilePage
      player={player}
      seasonRow={seasonRow}
      careerRow={careerRow}
      seasonLabel={`MHL1 ${currentSeason}`}
    />
  )
}
