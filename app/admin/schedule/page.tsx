import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getRequestUser } from '@/lib/supabase/request-user'
import ScheduleClient from './ScheduleClient'
import { getNow } from '@/lib/preview'
import { getSeasonSquad, getSelectedSeason, inSeason, seasonRoster } from '@/lib/season-server'
import { loadFines } from '@/lib/fines-server'
import { finedBySession } from '@/lib/fines'
import type { AttendanceRow, TeamListSelection } from '@/app/dashboard/schedule/page'
import type { GoalRow, CardRow } from '@/app/dashboard/schedule/resultActions'

export const metadata: Metadata = { title: 'Schedule' }

/** Adds each game's opponent full name (e.g. SAA → "St Andrew's Alumni") */
function withOpponentNames<G extends { opponent: string }>(games: G[], opponents: { short_name: string; full_name: string }[]) {
  const names = new Map(opponents.map((o) => [o.short_name, o.full_name]))
  return games.map((g) => ({ ...g, opponent_name: names.get(g.opponent) ?? null }))
}

function groupByGame<T extends { game_id: string | null }>(rows: T[]): Record<string, T[]> {
  const byGame: Record<string, T[]> = {}
  for (const r of rows) {
    if (!r.game_id) continue
    ;(byGame[r.game_id] ??= []).push(r)
  }
  return byGame
}

/** `?event=game-<id>` (Home's "Open details") opens that event's details */
export default async function AdminSchedulePage({ searchParams }: { searchParams: { event?: string | string[] } }) {
  const supabase = createClient()

  const [user, season] = await Promise.all([getRequestUser(), getSelectedSeason()])

  const [
    { data: games, error: gamesError },
    { data: trainings, error: trainingsError },
    { data: events, error: eventsError },
    { data: att },
    { data: me },
    squad,
    { data: teamListRaw },
    { data: goalRows },
    { data: cardRows },
    { data: potmRows },
    { fines },
    { data: opponents },
  ] = await Promise.all([
    inSeason(supabase.from('games').select('*'), season).order('game_date', { ascending: false }),
    inSeason(supabase.from('training_sessions').select('*'), season).order('session_date', { ascending: false }),
    inSeason(supabase.from('team_events').select('id, title, event_date, location, notes, ends_at, report_minutes, respond_by, fines_enabled, created_at'), season).order('event_date', { ascending: false }),
    fetchAll(() => supabase.from('attendance').select('player_id, session_id, status, responded_at, player:players(full_name, preferred_name)').order('id')),
    supabase
      .from('players')
      .select('id, attendance(session_id, status)')
      .eq('auth_user_id', user?.id ?? '')
      .single(),
    getSeasonSquad(season.id),
    supabase
      .from('match_team_lists')
      .select('game_id, player_id, selected'),
    fetchAll(() =>
      supabase
        .from('match_goals')
        .select('id, game_id, goal_number, scorer_id, assist_kind, assist_player_id')
        .order('goal_number', { ascending: true })
        .order('id')
    ),
    supabase
      .from('match_cards')
      .select('id, game_id, player_id, card_type')
      .not('game_id', 'is', null),
    fetchAll(() => supabase.from('potm').select('game_id, player_id, place').order('id')),
    loadFines(),
    supabase.from('opponents').select('short_name, full_name'),
  ])

  const error = gamesError ?? trainingsError ?? eventsError
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
      season={season}
      games={withOpponentNames(games ?? [], opponents ?? [])}
      trainings={trainings ?? []}
      events={events ?? []}
      attending={attending}
      myStatus={myStatus}
      now={getNow().toISOString()}
      roster={seasonRoster(squad, season.locked)}
      attendanceBySession={attendanceBySession}
      myPlayerId={me?.id ?? ''}
      isAdmin={true}
      teamListByGame={teamListByGame}
      goalsByGame={groupByGame((goalRows ?? []) as GoalRow[])}
      cardsByGame={groupByGame((cardRows ?? []) as CardRow[])}
      potmByGame={groupByGame((potmRows ?? []) as { game_id: string; player_id: string; place: number }[])}
      initialEventKey={typeof searchParams.event === 'string' ? searchParams.event : null}
      fined={finedBySession(fines)}
    />
  )
}
