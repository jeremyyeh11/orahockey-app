import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import { getSeasonSquad, getSelectedSeason, type SquadMember } from '@/lib/season-server'
import SquadClient from './SquadClient'
import type { MatchCardRow } from '@/lib/stats'

export const metadata: Metadata = { title: 'Squad' }

type AdminSquadMember = SquadMember & { email: string; role: 'player' | 'admin'; auth_user_id: string | null }

export default async function AdminSquadPage() {
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
    { data: whitelist },
  ] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    getSeasonSquad<AdminSquadMember>(season.id, 'email, role, auth_user_id').catch((e: Error) => e),
    supabase
      .from('player_stats')
      .select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists'),
    supabase
      .from('games')
      .select('id, opponent, game_date, goals_for, goals_against, result, season_id')
      .eq('season_id', season.id)
      .order('game_date', { ascending: false }),
    supabase.from('potm').select('game_id, player_id, place'),
    supabase
      .from('attendance')
      .select('player_id, session_id')
      .eq('session_type', 'game')
      .eq('status', 'attending'),
    supabase.from('match_cards').select('player_id, game_id, card_type, created_at'),
    supabase.from('player_whitelist').select('email, invited_at, claimed_at'),
  ])

  if (players instanceof Error) {
    return (
      <div className="p-4">
        <p className="text-red-400 text-sm">{players.message}</p>
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
      whitelist={whitelist ?? []}
    />
  )
}
