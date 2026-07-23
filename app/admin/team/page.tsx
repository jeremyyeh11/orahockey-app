import { createClient } from '@/lib/supabase/server'
import SquadClient from './SquadClient'
import type { MatchCardRow } from '@/lib/stats'

export default async function AdminSquadPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: me },
    { data: players, error },
    { data: stats },
    { data: games },
    { data: potm },
    { data: att },
    { data: cards },
    { data: whitelist },
  ] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    supabase
      .from('players')
      .select('id, full_name, email, jersey_number, position, role, is_active, auth_user_id, preferred_name')
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true }),
    supabase
      .from('player_stats')
      .select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists'),
    supabase
      .from('games')
      .select('id, opponent, game_date, goals_for, goals_against, result')
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

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-400 text-sm">Error loading players: {error.message}</p>
      </div>
    )
  }

  return (
    <SquadClient
      players={players ?? []}
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
