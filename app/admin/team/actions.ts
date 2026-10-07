'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOpenSeason } from '@/lib/season-server'
import { revalidatePath } from 'next/cache'

type PlayerInput = {
  full_name: string
  preferred_name: string | null
  email: string
  jersey_number: number | null
  position: string[] | null
  role: 'player' | 'admin'
}

export async function addPlayer(data: PlayerInput) {
  const supabase = createClient()
  const season = await requireOpenSeason()

  // Assign to the first (only) team if one exists
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .limit(1)
    .single()

  const { data: player, error } = await supabase
    .from('players')
    .insert({
      ...data,
      team_id: team?.id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // A DB trigger adds new players to the current season's squad; also cover an
  // open season that isn't current (no-op when it's the same one).
  const { error: squadError } = await supabase
    .from('season_players')
    .upsert(
      { season_id: season.id, player_id: player.id, jersey_number: data.jersey_number, position: data.position },
      { onConflict: 'season_id,player_id', ignoreDuplicates: true }
    )
  if (squadError) throw new Error(squadError.message)

  revalidatePath('/admin/team')
}

export async function updatePlayer(id: string, data: PlayerInput) {
  const supabase = createClient()
  const season = await requireOpenSeason()

  const { error } = await supabase
    .from('players')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)

  // Jersey number and position are per season
  const { error: squadError } = await supabase
    .from('season_players')
    .update({ jersey_number: data.jersey_number, position: data.position })
    .eq('season_id', season.id)
    .eq('player_id', id)
  if (squadError) throw new Error(squadError.message)

  revalidatePath('/admin/team')
}

export async function importPlayers(rows: { full_name: string; email: string; role: 'player' | 'admin' }[]) {
  const supabase = createClient()
  await requireOpenSeason()

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
  await requireOpenSeason()

  const { error } = await supabase
    .from('players')
    .update({ is_active })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}
