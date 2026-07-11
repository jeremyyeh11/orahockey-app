import { createClient } from '@/lib/supabase/server'
import StatsClient from './StatsClient'

export default async function AdminStatsPage() {
  const supabase = createClient()

  const [{ data: players, error: playersError }, { data: games, error: gamesError }, { data: stats }] =
    await Promise.all([
      supabase
        .from('players')
        .select('id, full_name, jersey_number, position')
        .eq('is_active', true)
        .order('jersey_number', { ascending: true, nullsFirst: false })
        .order('full_name'),
      supabase
        .from('games')
        .select('id, opponent, game_date, goals_for, goals_against, result')
        .order('game_date', { ascending: false }),
      supabase.from('player_stats').select('player_id, game_id, goals, assists, clean_sheet'),
    ])

  const error = playersError ?? gamesError
  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Error loading stats: {error.message}</p>
      </div>
    )
  }

  return <StatsClient players={players ?? []} games={games ?? []} stats={stats ?? []} />
}
