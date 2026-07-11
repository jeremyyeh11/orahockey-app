'use server'

import { createClient } from '@/lib/supabase/server'
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
}

export type TrainingInput = {
  session_date: string
  location: string | null
  notes: string | null
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

export async function addGame(data: GameInput) {
  const supabase = createClient()

  const { data: team } = await supabase.from('teams').select('id').limit(1).single()

  const { error } = await supabase.from('games').insert({
    ...data,
    result: deriveResult(data.goals_for, data.goals_against),
    team_id: team?.id ?? null,
  })

  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateGame(id: string, data: GameInput) {
  const supabase = createClient()

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

  const { data: team } = await supabase.from('teams').select('id').limit(1).single()

  const { error } = await supabase.from('training_sessions').insert({
    ...data,
    team_id: team?.id ?? null,
  })

  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateTraining(id: string, data: TrainingInput) {
  const supabase = createClient()

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
