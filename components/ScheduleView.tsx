import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getRequestUser } from '@/lib/supabase/request-user'
import ScheduleClient from '@/components/ScheduleClient'
import { getNow } from '@/lib/preview'
import { getSeasonSquad, getSelectedSeason, inSeason, seasonRoster } from '@/lib/season-server'
import { loadFines } from '@/lib/fines-server'
import { finedBySession } from '@/lib/fines'
import type { AttendanceRow } from '@/components/EventDetailModal'
import type { MyStatus } from '@/components/EventRow'
import type { GoalRow, CardRow } from '@/app/dashboard/schedule/resultActions'

type TeamListSelection = {
  game_id: string
  player_id: string
  selected: boolean
}

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

/**
 * Shared loader + render for the Schedule tab. Used by both the admin and
 * player `schedule` routes; `basePath` '/admin' turns on the admin controls
 * (add/edit/delete, row headcounts, season record). `event` (`game-<id>`,
 * from Home's links) opens that event's details.
 */
export async function ScheduleView({ basePath, event }: { basePath: '/dashboard' | '/admin'; event?: string }) {
  const isAdmin = basePath === '/admin'
  const supabase = createClient()

  const [user, season] = await Promise.all([getRequestUser(), getSelectedSeason()])

  const [
    { data: games, error: gamesError },
    { data: trainings, error: trainingsError },
    { data: events, error: eventsError },
    { data: me },
    { data: att },
    squad,
    { data: teamListRaw },
    { data: goalRows },
    { data: cardRows },
    { data: potmRows },
    { fines },
    { data: opponents },
  ] = await Promise.all([
    inSeason(
      supabase
        .from('games')
        .select('id, opponent, game_date, location, home_away, game_type, goals_for, goals_against, result, notes, team_list_status, ends_at, report_minutes, respond_by, fines_enabled'),
      season
    ).order('game_date', { ascending: false }),
    inSeason(supabase.from('training_sessions').select('id, session_date, location, notes, ends_at, report_minutes, respond_by, fines_enabled'), season)
      .order('session_date', { ascending: false }),
    inSeason(supabase.from('team_events').select('id, title, event_date, location, notes, ends_at, report_minutes, respond_by, fines_enabled, created_at'), season)
      .order('event_date', { ascending: false }),
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    fetchAll(() =>
      supabase
        .from('attendance')
        .select('player_id, session_id, status, responded_at, player:players(full_name, preferred_name)')
        .order('id')
    ),
    getSeasonSquad(season.id),
    // Admins see all team list selections; players only see published (RLS handles this)
    supabase.from('match_team_lists').select('game_id, player_id, selected'),
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

  const attendance = (att ?? []) as unknown as AttendanceRow[]

  // My own answers, and the attendance breakdown per session
  const myStatus: Record<string, MyStatus> = {}
  const attendanceBySession: Record<string, AttendanceRow[]> = {}
  for (const a of attendance) {
    if (a.player_id === me?.id) myStatus[a.session_id] = a.status
    ;(attendanceBySession[a.session_id] ??= []).push(a)
  }

  // Headcounts on the admin rows
  let attending: Record<string, number> | undefined
  if (isAdmin) {
    attending = {}
    for (const a of attendance) {
      if (a.status === 'attending') attending[a.session_id] = (attending[a.session_id] ?? 0) + 1
    }
  }

  // Team list selections per game
  const teamListByGame: Record<string, Record<string, boolean>> = {}
  for (const t of (teamListRaw ?? []) as TeamListSelection[]) {
    ;(teamListByGame[t.game_id] ??= {})[t.player_id] = t.selected
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
      isAdmin={isAdmin}
      teamListByGame={teamListByGame}
      goalsByGame={groupByGame((goalRows ?? []) as GoalRow[])}
      cardsByGame={groupByGame((cardRows ?? []) as CardRow[])}
      potmByGame={groupByGame((potmRows ?? []) as { game_id: string; player_id: string; place: number }[])}
      initialEventKey={event ?? null}
      fined={finedBySession(fines)}
    />
  )
}
