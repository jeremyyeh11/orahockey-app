import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'
import { getNow } from '@/lib/preview'
import { cookies } from 'next/headers'
import { VIEW_COOKIE } from '@/lib/preview'
import type { GoalRow, CardRow } from './resultActions'

function groupByGame<T extends { game_id: string | null }>(rows: T[]): Record<string, T[]> {
  const byGame: Record<string, T[]> = {}
  for (const r of rows) {
    if (!r.game_id) continue
    ;(byGame[r.game_id] ??= []).push(r)
  }
  return byGame
}

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
  position: string[] | null
  jersey_number: number | null
}

export type TeamListSelection = {
  game_id: string
  player_id: string
  selected: boolean
}

export default async function PlayerSchedulePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const isAdmin = me?.role === 'admin' && cookies().get(VIEW_COOKIE)?.value !== 'player'

  const [
    { data: games, error: gamesError },
    { data: trainings, error: trainingsError },
    { data: myAtt },
    { data: allAtt },
    { data: roster },
    { data: teamListRaw },
    { data: goalRows },
    { data: cardRows },
    { data: potmRows },
  ] = await Promise.all([
    supabase
      .from('games')
      .select('id, opponent, game_date, location, home_away, game_type, goals_for, goals_against, result, notes, team_list_status')
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
      .select('id, full_name, preferred_name, position, jersey_number')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    // Admins see all team list selections; players only see published (RLS handles this)
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
    supabase.from('potm').select('game_id, player_id, place'),
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
      myStatus={myStatus}
      now={getNow().toISOString()}
      roster={(roster ?? []) as RosterPlayer[]}
      attendanceBySession={attendanceBySession}
      myPlayerId={me?.id ?? ''}
      isAdmin={isAdmin}
      teamListByGame={teamListByGame}
      goalsByGame={groupByGame((goalRows ?? []) as GoalRow[])}
      cardsByGame={groupByGame((cardRows ?? []) as CardRow[])}
      potmByGame={groupByGame((potmRows ?? []) as { game_id: string; player_id: string; place: number }[])}
    />
  )
}
