import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'
import { getNow } from '@/lib/preview'

export default async function AdminSchedulePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: games, error: gamesError },
    { data: trainings, error: trainingsError },
    { data: att },
    { data: me },
  ] = await Promise.all([
    supabase.from('games').select('*').order('game_date', { ascending: false }),
    supabase.from('training_sessions').select('*').order('session_date', { ascending: false }),
    supabase.from('attendance').select('session_id, status').eq('status', 'attending'),
    supabase
      .from('players')
      .select('id, attendance(session_id, status)')
      .eq('auth_user_id', user?.id ?? '')
      .single(),
  ])

  const error = gamesError ?? trainingsError
  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Error loading schedule: {error.message}</p>
      </div>
    )
  }

  const attending: Record<string, number> = {}
  for (const a of att ?? []) {
    attending[a.session_id] = (attending[a.session_id] ?? 0) + 1
  }

  const myStatus: Record<string, 'attending' | 'not_attending' | 'maybe'> = {}
  for (const a of me?.attendance ?? []) {
    myStatus[a.session_id] = a.status
  }

  return (
    <ScheduleClient
      games={games ?? []}
      trainings={trainings ?? []}
      attending={attending}
      myStatus={myStatus}
      now={getNow().toISOString()}
    />
  )
}
