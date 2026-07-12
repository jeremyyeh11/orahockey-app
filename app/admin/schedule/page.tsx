import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'
import { getNow } from '@/lib/preview'
import type { AttendanceRow, RosterPlayer } from '@/app/dashboard/schedule/page'

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
    { data: roster },
  ] = await Promise.all([
    supabase.from('games').select('*').order('game_date', { ascending: false }),
    supabase.from('training_sessions').select('*').order('session_date', { ascending: false }),
    supabase.from('attendance').select('player_id, session_id, status, player:players(full_name, preferred_name)'),
    supabase
      .from('players')
      .select('id, attendance(session_id, status)')
      .eq('auth_user_id', user?.id ?? '')
      .single(),
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

  const attending: Record<string, number> = {}
  for (const a of att ?? []) {
    if (a.status === 'attending') {
      attending[a.session_id] = (attending[a.session_id] ?? 0) + 1
    }
  }

  const myStatus: Record<string, 'attending' | 'not_attending' | 'maybe'> = {}
  for (const a of me?.attendance ?? []) {
    myStatus[a.session_id] = a.status
  }

  // Build attendance breakdown per session
  const attendanceBySession: Record<string, AttendanceRow[]> = {}
  for (const a of (att ?? []) as unknown as AttendanceRow[]) {
    if (!attendanceBySession[a.session_id]) attendanceBySession[a.session_id] = []
    attendanceBySession[a.session_id].push(a)
  }

  return (
    <ScheduleClient
      games={games ?? []}
      trainings={trainings ?? []}
      attending={attending}
      myStatus={myStatus}
      now={getNow().toISOString()}
      roster={(roster ?? []) as RosterPlayer[]}
      attendanceBySession={attendanceBySession}
      myPlayerId={me?.id ?? ''}
    />
  )
}
