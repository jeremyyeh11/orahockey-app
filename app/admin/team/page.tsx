import { createClient } from '@/lib/supabase/server'
import SquadClient from './SquadClient'

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
  ] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    supabase
      .from('players')
      .select('id, full_name, email, jersey_number, position, role, is_active, auth_user_id')
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true }),
    supabase
      .from('player_stats')
      .select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists, clean_sheet'),
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
      myPlayerId={me?.id ?? null}
    />
  )
}
