import { createClient } from '@/lib/supabase/server'
import StatsClient from './StatsClient'

export default async function PlayerStatsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: me }, { data: players }, { data: stats, error }, { data: games }, { data: potm }, { data: att }] =
    await Promise.all([
      supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
      supabase.from('players').select('id, full_name, jersey_number').eq('is_active', true),
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
        <p className="text-sm text-red-400">Error loading stats: {error.message}</p>
      </div>
    )
  }

  return (
    <StatsClient
      players={players ?? []}
      games={games ?? []}
      stats={stats ?? []}
      potm={potm ?? []}
      attendance={att ?? []}
      myPlayerId={me?.id ?? null}
    />
  )
}
