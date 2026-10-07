'use server'

import { createClient } from '@/lib/supabase/server'
import { hasSeasonRecord, requireOpenSeason } from '@/lib/season-server'
import { getNow } from '@/lib/preview'
import { revalidatePath } from 'next/cache'

// Squad changes are admin-only: /admin routes are gated in middleware, these
// actions check is_admin() themselves, and RLS allows season_players writes to
// admins only (and the season_lock trigger blocks archived seasons).
async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc('is_admin')
  if (error || data !== true) throw new Error('Only admins can change the squad.')
}

function revalidateSquad() {
  revalidatePath('/admin/team', 'layout')
  revalidatePath('/dashboard/team', 'layout')
  revalidatePath('/admin/schedule')
  revalidatePath('/dashboard/schedule')
}

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
  await requireAdmin(supabase)
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

  revalidateSquad()
}

export async function updatePlayer(id: string, data: PlayerInput) {
  const supabase = createClient()
  await requireAdmin(supabase)
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

  revalidateSquad()
}

export async function importPlayers(rows: { full_name: string; email: string; role: 'player' | 'admin' }[]) {
  const supabase = createClient()
  await requireAdmin(supabase)
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
  revalidateSquad()
  return { imported: data?.length ?? 0 }
}

export async function togglePlayerActive(id: string, is_active: boolean) {
  const supabase = createClient()
  await requireAdmin(supabase)
  await requireOpenSeason()

  const { error } = await supabase
    .from('players')
    .update({ is_active })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidateSquad()
}

/**
 * Add existing players (e.g. returning after a season out) to the selected open
 * season's squad, with their latest jersey number and position, and make sure
 * they're active so they show in the squad.
 */
export async function addPlayersToSeason(playerIds: string[]) {
  const supabase = createClient()
  await requireAdmin(supabase)
  const season = await requireOpenSeason()
  if (playerIds.length === 0) return

  const { data: players, error } = await supabase
    .from('players')
    .select('id, jersey_number, position')
    .in('id', playerIds)
  if (error) throw new Error(error.message)

  const { error: squadError } = await supabase.from('season_players').upsert(
    (players ?? []).map((p) => ({
      season_id: season.id,
      player_id: p.id,
      jersey_number: p.jersey_number,
      position: p.position,
    })),
    { onConflict: 'season_id,player_id', ignoreDuplicates: true }
  )
  if (squadError) throw new Error(squadError.message)

  const { error: activeError } = await supabase.from('players').update({ is_active: true }).in('id', playerIds)
  if (activeError) throw new Error(activeError.message)

  revalidateSquad()
}

/**
 * Take a player out of the selected open season's squad. Refused if they already
 * have a record that season (their stats would drop out of the leaderboards) —
 * mark them inactive instead. Their RSVPs for the season's upcoming events go too.
 */
export async function removePlayerFromSeason(playerId: string) {
  const supabase = createClient()
  await requireAdmin(supabase)
  const season = await requireOpenSeason()

  if (await hasSeasonRecord(season.id, playerId)) {
    throw new Error(`They already have ${season.label} appearances or stats — mark them inactive instead.`)
  }

  const now = getNow().toISOString()
  const [{ data: games }, { data: trainings }] = await Promise.all([
    supabase.from('games').select('id').eq('season_id', season.id).gt('game_date', now),
    supabase.from('training_sessions').select('id').eq('season_id', season.id).gt('session_date', now),
  ])
  const upcomingIds = [...(games ?? []), ...(trainings ?? [])].map((e) => e.id)
  if (upcomingIds.length > 0) {
    const { error } = await supabase.from('attendance').delete().eq('player_id', playerId).in('session_id', upcomingIds)
    if (error) throw new Error(error.message)
  }

  const { error } = await supabase
    .from('season_players')
    .delete()
    .eq('season_id', season.id)
    .eq('player_id', playerId)
  if (error) throw new Error(error.message)

  revalidateSquad()
}
