'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOpenSeason } from '@/lib/season-server'
import { revalidatePath } from 'next/cache'

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
}

export type TrainingInput = {
  session_date: string
  location: string | null
  notes: string | null
  ends_at: string | null
  report_minutes: number | null
}

/** A titled team event — gathering, meeting, social… */
export type EventInput = {
  title: string
  event_date: string
  location: string | null
  notes: string | null
  ends_at: string | null
  report_minutes: number | null
}

function cleanEvent(data: EventInput): EventInput {
  const title = data.title.trim()
  if (!title) throw new Error('Give the event a title.')
  checkTimes(data.event_date, data)
  return { ...data, title }
}

/** End after start; report-early 0–600 whole minutes (the database checks too) */
function checkTimes(start: string, data: { ends_at: string | null; report_minutes: number | null }) {
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

function revalidate() {
  revalidatePath('/admin/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/schedule')
}

// Edits and deletes of a locked season's events are rejected by the database
// (season_lock trigger) with a readable message; adds go into the season being
// viewed, which must be open.

export async function addGame(data: GameInput) {
  const supabase = createClient()
  checkTimes(data.game_date, data)
  const season = await requireOpenSeason()

  const { data: team } = await supabase.from('teams').select('id').limit(1).single()

  const { error } = await supabase.from('games').insert({
    ...data,
    result: deriveResult(data.goals_for, data.goals_against),
    team_id: team?.id ?? null,
    season_id: season.id,
  })

  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateGame(id: string, data: GameInput) {
  const supabase = createClient()
  checkTimes(data.game_date, data)

  const { error } = await supabase
    .from('games')
    .update({ ...data, result: deriveResult(data.goals_for, data.goals_against) })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}

export async function deleteGame(id: string) {
  const supabase = createClient()

  const { error } = await supabase.from('games').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}

export async function addTraining(data: TrainingInput) {
  const supabase = createClient()
  checkTimes(data.session_date, data)
  const season = await requireOpenSeason()

  const { data: team } = await supabase.from('teams').select('id').limit(1).single()

  const { error } = await supabase.from('training_sessions').insert({
    ...data,
    team_id: team?.id ?? null,
    season_id: season.id,
  })

  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateTraining(id: string, data: TrainingInput) {
  const supabase = createClient()
  checkTimes(data.session_date, data)

  const { error } = await supabase.from('training_sessions').update(data).eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}

export async function deleteTraining(id: string) {
  const supabase = createClient()

  const { error } = await supabase.from('training_sessions').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}

export async function addEvent(data: EventInput) {
  const supabase = createClient()
  const season = await requireOpenSeason()

  const { data: team } = await supabase.from('teams').select('id').limit(1).single()

  const { error } = await supabase.from('team_events').insert({
    ...cleanEvent(data),
    team_id: team?.id ?? null,
    season_id: season.id,
  })

  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateEvent(id: string, data: EventInput) {
  const supabase = createClient()

  const { error } = await supabase.from('team_events').update(cleanEvent(data)).eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}

export async function deleteEvent(id: string) {
  const supabase = createClient()

  // RSVPs point at the event without a foreign key — clear them first
  const { error: rsvpError } = await supabase.from('attendance').delete().eq('session_id', id).eq('session_type', 'event')
  if (rsvpError) throw new Error(rsvpError.message)

  const { error } = await supabase.from('team_events').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}
