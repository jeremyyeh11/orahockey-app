import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'

export default async function PlayerSchedulePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const [{ data: games, error: gamesError }, { data: trainings, error: trainingsError }, { data: myAtt }] =
    await Promise.all([
      supabase
        .from('games')
        .select('id, opponent, game_date, location, home_away, game_type, goals_for, goals_against, result')
        .order('game_date', { ascending: false }),
      supabase
        .from('training_sessions')
        .select('id, session_date, location, notes')
        .order('session_date', { ascending: false }),
      supabase.from('attendance').select('session_id, status').eq('player_id', me?.id ?? ''),
    ])

  const error = gamesError ?? trainingsError
  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Error loading schedule: {error.message}</p>
      </div>
    )
  }

  const myStatus: Record<string, 'attending' | 'not_attending' | 'maybe'> = {}
  for (const a of myAtt ?? []) {
    myStatus[a.session_id] = a.status
  }

  return <ScheduleClient games={games ?? []} trainings={trainings ?? []} myStatus={myStatus} />
}
