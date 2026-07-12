import { createClient } from '@/lib/supabase/server'
import StatsClient from './StatsClient'

export default async function AdminStatsPage() {
  const supabase = createClient()

  const [
    { data: players, error: playersError },
    { data: games, error: gamesError },
    { data: stats },
    { data: att },
  ] = await Promise.all([
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
    supabase
      .from('player_stats')
      .select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists, clean_sheet'),
    supabase
      .from('attendance')
      .select('player_id, session_id')
      .eq('session_type', 'game')
      .eq('status', 'attending'),
  ])

  const error = playersError ?? gamesError
  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Error loading stats: {error.message}</p>
      </div>
    )
  }

  // Caps = games played. Derived from attendance on played games —
  // placeholder numbers until real attendance is tracked.
  const playedIds = new Set((games ?? []).filter((g) => g.result).map((g) => g.id))
  const caps: Record<string, number> = {}
  for (const a of att ?? []) {
    if (playedIds.has(a.session_id)) caps[a.player_id] = (caps[a.player_id] ?? 0) + 1
  }

  return <StatsClient players={players ?? []} games={games ?? []} stats={stats ?? []} caps={caps} />
}
