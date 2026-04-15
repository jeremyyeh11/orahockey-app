'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type PlayerInput = {
  full_name: string
  email: string
  jersey_number: number | null
  position: string[] | null
  role: 'player' | 'admin'
}

export async function addPlayer(data: PlayerInput) {
  const supabase = createClient()

  // Assign to the first (only) team if one exists
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .limit(1)
    .single()

  const { error } = await supabase.from('players').insert({
    ...data,
    team_id: team?.id ?? null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}

export async function updatePlayer(id: string, data: PlayerInput) {
  const supabase = createClient()

  const { error } = await supabase
    .from('players')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}

export async function importPlayers(rows: { full_name: string; email: string; role: 'player' | 'admin' }[]) {
  const supabase = createClient()

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .limit(1)
    .single()

  const players = rows.map(r => ({
    full_name: r.full_name,
    email: r.email,
    role: r.role,
    team_id: team?.id ?? null,
  }))

  const { data, error } = await supabase
    .from('players')
    .upsert(players, { onConflict: 'email', ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
  return { imported: data?.length ?? 0 }
}

export async function togglePlayerActive(id: string, is_active: boolean) {
  const supabase = createClient()

  const { error } = await supabase
    .from('players')
    .update({ is_active })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}
