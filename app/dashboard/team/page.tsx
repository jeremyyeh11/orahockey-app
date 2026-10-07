import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import { getSeasonSquad, getSelectedSeason, inSeason } from '@/lib/season-server'
import SquadClient from './SquadClient'
import type { MatchCardRow } from '@/lib/stats'

export const metadata: Metadata = { title: 'Squad' }

export default async function PlayerSquadPage() {
  const supabase = createClient()

  const [user, season] = await Promise.all([getRequestUser(), getSelectedSeason()])

  const [
    { data: me },
    players,
    { data: stats },
    { data: games },
    { data: potm },
    { data: att },
    { data: cards },
  ] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    getSeasonSquad(season.id).catch((e: Error) => e),
    supabase
      .from('player_stats')
      .select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists'),
    inSeason(supabase.from('games').select('id, game_date, result, goals_against, season_id, game_type'), season).order('game_date', { ascending: false }),
    supabase.from('potm').select('game_id, player_id, place'),
    supabase
      .from('attendance')
      .select('player_id, session_id')
      .eq('session_type', 'game')
      .eq('status', 'attending'),
    supabase.from('match_cards').select('player_id, game_id, card_type, created_at'),
  ])

  if (players instanceof Error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">{players.message}</p>
      </div>
    )
  }

  return (
    <SquadClient
      season={season}
      players={players}
      games={games ?? []}
      stats={stats ?? []}
      potm={potm ?? []}
      attendance={att ?? []}
      cards={(cards ?? []) as MatchCardRow[]}
      myPlayerId={me?.id ?? null}
    />
  )
}
