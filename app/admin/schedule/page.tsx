import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'
import { getNow } from '@/lib/preview'
import type { AttendanceRow, RosterPlayer, TeamListSelection } from '@/app/dashboard/schedule/page'
import type { GoalRow, CardRow } from '@/app/dashboard/schedule/resultActions'

function groupByGame<T extends { game_id: string | null }>(rows: T[]): Record<string, T[]> {
  const byGame: Record<string, T[]> = {}
  for (const r of rows) {
    if (!r.game_id) continue
    ;(byGame[r.game_id] ??= []).push(r)
  }
  return byGame
}

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
    { data: teamListRaw },
    { data: goalRows },
    { data: cardRows },
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
      .select('id, full_name, preferred_name, position, jersey_number')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase
      .from('match_team_lists')
      .select('game_id, player_id, selected'),
    supabase
      .from('match_goals')
      .select('id, game_id, goal_number, scorer_id, assist_kind, assist_player_id')
      .order('goal_number', { ascending: true }),
    supabase
      .from('match_cards')
      .select('id, game_id, player_id, card_type')
      .not('game_id', 'is', null),
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

  // Build team list selections per game
  const teamListByGame: Record<string, Record<string, boolean>> = {}
  for (const t of (teamListRaw ?? []) as unknown as TeamListSelection[]) {
    if (!teamListByGame[t.game_id]) teamListByGame[t.game_id] = {}
    teamListByGame[t.game_id][t.player_id] = t.selected
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
      isAdmin={true}
      teamListByGame={teamListByGame}
      goalsByGame={groupByGame((goalRows ?? []) as GoalRow[])}
      cardsByGame={groupByGame((cardRows ?? []) as CardRow[])}
    />
  )
}
