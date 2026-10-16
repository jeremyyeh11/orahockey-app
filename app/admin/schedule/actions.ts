'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOpenSeason } from '@/lib/season-server'
import { action, requireAdmin, revalidateTabs, teamId } from '@/lib/action-helpers'
import { STATUS_REASON_MAX, type EventKind, type EventStatus } from '@/lib/event-status'

export type GameInput = {
  opponent: string
  game_date: string
  location: string | null
  home_away: 'home' | 'away' | null
  game_type: 'regular' | 'playoff' | 'exhibition'
  goals_for: number | null
  goals_against: number | null
  notes: string | null
  ends_at: string | null
  report_minutes: number | null
} & FinesInput

/** Reply deadline + whether missing it is fined (lib/fines.ts) */
export type FinesInput = {
  respond_by: string | null
  fines_enabled: boolean
}

export type TrainingInput = {
  session_date: string
  location: string | null
  notes: string | null
  ends_at: string | null
  report_minutes: number | null
} & FinesInput

/** A titled team event — gathering, meeting, social… */
export type EventInput = {
  title: string
  event_date: string
  location: string | null
  notes: string | null
  ends_at: string | null
  report_minutes: number | null
} & FinesInput

function cleanEvent(data: EventInput): EventInput {
  const title = data.title.trim()
  if (!title) throw new Error('Give the event a title.')
  checkTimes(data.event_date, data)
  return { ...data, title }
}

/** End after start; report-early 0–600 whole minutes (the database checks too); a real respond-by */
function checkTimes(start: string, data: { ends_at: string | null; report_minutes: number | null; respond_by?: string | null }) {
  if (data.respond_by && Number.isNaN(new Date(data.respond_by).getTime())) {
    throw new Error('Respond by is not a valid date.')
  }
  if (data.ends_at && new Date(data.ends_at).getTime() <= new Date(start).getTime()) {
    throw new Error('The end time must be after the start.')
  }
  if (data.report_minutes != null && (!Number.isInteger(data.report_minutes) || data.report_minutes < 0 || data.report_minutes > 600)) {
    throw new Error('Report early must be 0–600 minutes.')
  }
}

function deriveResult(gf: number | null, ga: number | null) {
  if (gf == null || ga == null) return null
  return gf > ga ? 'win' : gf < ga ? 'loss' : 'tie'
}

// Edits and deletes of a locked season's events are rejected by the database
// (season_lock trigger) with a readable message; adds go into the season being
// viewed, which must be open.

export const addGame = action(async (data: GameInput) => {
  const supabase = createClient()
  await requireAdmin(supabase)
  checkTimes(data.game_date, data)
  const season = await requireOpenSeason()

  const { error } = await supabase.from('games').insert({
    ...data,
    result: deriveResult(data.goals_for, data.goals_against),
    team_id: await teamId(supabase),
    season_id: season.id,
  })

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

export const updateGame = action(async (id: string, data: GameInput) => {
  const supabase = createClient()
  await requireAdmin(supabase)
  checkTimes(data.game_date, data)

  const { error } = await supabase
    .from('games')
    .update({ ...data, result: deriveResult(data.goals_for, data.goals_against) })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

export const deleteGame = action(async (id: string) => {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { error } = await supabase.from('games').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

export const addTraining = action(async (data: TrainingInput) => {
  const supabase = createClient()
  await requireAdmin(supabase)
  checkTimes(data.session_date, data)
  const season = await requireOpenSeason()

  const { error } = await supabase.from('training_sessions').insert({
    ...data,
    team_id: await teamId(supabase),
    season_id: season.id,
  })

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

export const updateTraining = action(async (id: string, data: TrainingInput) => {
  const supabase = createClient()
  await requireAdmin(supabase)
  checkTimes(data.session_date, data)

  const { error } = await supabase.from('training_sessions').update(data).eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

export const deleteTraining = action(async (id: string) => {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { error } = await supabase.from('training_sessions').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

export const addEvent = action(async (data: EventInput) => {
  const supabase = createClient()
  await requireAdmin(supabase)
  const season = await requireOpenSeason()

  const { error } = await supabase.from('team_events').insert({
    ...cleanEvent(data),
    team_id: await teamId(supabase),
    season_id: season.id,
  })

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

export const updateEvent = action(async (id: string, data: EventInput) => {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { error } = await supabase.from('team_events').update(cleanEvent(data)).eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})

const STATUS_TABLE = { game: 'games', training: 'training_sessions', event: 'team_events' } as const

/**
 * Cancel a game, training or team event, postpone a game, or reinstate one
 * ('scheduled'), with a reason the squad sees. It stays on the schedule with its
 * RSVPs but counts for nothing — no appearances, attendance % or POTM, and no
 * fines after the cancel (038, 040).
 */
export const setEventStatus = action(async (
  kind: EventKind,
  id: string,
  status: EventStatus,
  reason: string | null
) => {
  const supabase = createClient()
  await requireAdmin(supabase)
  if (status === 'postponed' && kind !== 'game') throw new Error('Only matches can be postponed.')
  const text = status === 'scheduled' ? null : reason?.trim() || null
  if (status !== 'scheduled' && !text) throw new Error(`Give a reason for ${status === 'cancelled' ? 'cancelling' : 'postponing'}.`)
  if (text && text.length > STATUS_REASON_MAX) throw new Error(`Keep the reason under ${STATUS_REASON_MAX} characters.`)

  // A cancelled or postponed match has no result (the database checks too)
  if (kind === 'game' && status !== 'scheduled') {
    const { data: game } = await supabase.from('games').select('result').eq('id', id).single()
    if (game?.result) throw new Error('This match has a result. Clear the score in Edit first.')
  }

  const { error } = await supabase.from(STATUS_TABLE[kind]).update({ status, status_reason: text }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home', 'fines', 'team', 'profile')
})

export const deleteEvent = action(async (id: string) => {
  const supabase = createClient()
  await requireAdmin(supabase)

  // RSVPs point at the event without a foreign key — clear them first
  const { error: rsvpError } = await supabase.from('attendance').delete().eq('session_id', id).eq('session_type', 'event')
  if (rsvpError) throw new Error(rsvpError.message)

  const { error } = await supabase.from('team_events').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('schedule', 'home')
})
