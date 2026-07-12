import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'
import { getNow } from '@/lib/preview'

export type AttendanceRow = {
  player_id: string
  session_id: string
  status: 'attending' | 'not_attending' | 'maybe'
  player: { full_name: string; preferred_name: string | null }
}

export type RosterPlayer = {
  id: string
  full_name: string
  preferred_name: string | null
}

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

  const [
    { data: games, error: gamesError },
    { data: trainings, error: trainingsError },
    { data: myAtt },
    { data: allAtt },
    { data: roster },
  ] = await Promise.all([
    supabase
      .from('games')
      .select('id, opponent, game_date, location, home_away, game_type, goals_for, goals_against, result, notes')
      .order('game_date', { ascending: false }),
    supabase
      .from('training_sessions')
      .select('id, session_date, location, notes')
      .order('session_date', { ascending: false }),
    supabase.from('attendance').select('session_id, status').eq('player_id', me?.id ?? ''),
    supabase
      .from('attendance')
      .select('player_id, session_id, status, player:players(full_name, preferred_name)'),
    supabase
      .from('players')
      .select('id, full_name, preferred_name')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
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

  // Build attendance breakdown per session
  const attendanceBySession: Record<string, AttendanceRow[]> = {}
  for (const a of (allAtt ?? []) as unknown as AttendanceRow[]) {
    if (!attendanceBySession[a.session_id]) attendanceBySession[a.session_id] = []
    attendanceBySession[a.session_id].push(a)
  }

  return (
    <ScheduleClient
      games={games ?? []}
      trainings={trainings ?? []}
      myStatus={myStatus}
      now={getNow().toISOString()}
      roster={roster ?? []}
      attendanceBySession={attendanceBySession}
      myPlayerId={me?.id ?? ''}
    />
  )
}
