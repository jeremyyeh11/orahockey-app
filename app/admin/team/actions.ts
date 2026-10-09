'use server'

import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason, hasSeasonRecord, requireOpenSeason } from '@/lib/season-server'
import { getRequestUser } from '@/lib/supabase/request-user'
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
  /** Optional: a player can be added pending onboarding and get their email later */
  email: string | null
  jersey_number: number | null
  position: string[] | null
  role: 'player' | 'admin'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trimmed + lowercased; blank → null (pending). Throws on something that isn't an email. */
function normalizeEmail(email: string | null): string | null {
  const e = email?.trim().toLowerCase() ?? ''
  if (!e) return null
  if (!EMAIL_RE.test(e)) throw new Error(`"${email}" doesn't look like an email address.`)
  return e
}

function friendlyPlayerError(message: string, code?: string) {
  if (code === '23505' && message.includes('email')) return 'Another player already uses that email.'
  return message
}

/**
 * Add a player. `joinSeason` (default) puts them in the selected open season's
 * squad. Without it they're created inactive and in no season — e.g. a past
 * player added retroactively (attaching them to an archived season is a
 * backend job).
 */
export async function addPlayer(data: PlayerInput, joinSeason = true) {
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
      full_name: data.full_name.trim().toUpperCase(),
      email: normalizeEmail(data.email),
      // Inactive players don't auto-join the current season (DB trigger)
      is_active: joinSeason,
      team_id: team?.id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(friendlyPlayerError(error.message, error.code))
  if (!joinSeason) {
    revalidateSquad()
    return
  }

  // A DB trigger adds new players to the current season's squad; also cover an
  // open season that isn't current (no-op when it's the same one).
  const { error: squadError } = await supabase
    .from('season_players')
    .upsert(
      { season_id: season.id, player_id: player.id, jersey_number: data.jersey_number },
      { onConflict: 'season_id,player_id', ignoreDuplicates: true }
    )
  if (squadError) throw new Error(squadError.message)

  revalidateSquad()
}

export type PlayerDetailsInput = {
  full_name: string
  preferred_name: string | null
  /** Only changeable before they have an account (it's their login) */
  email: string | null
  role: 'player' | 'admin'
  /** Every position they play — per player, across seasons */
  position: string[] | null
  date_of_birth: string | null
  is_active: boolean
  /** The selected season's number if they're in its squad, else their default for new seasons */
  jersey_number: number | null
}

/**
 * Admin edit of a player's details (profile → Edit). Identity fields live on
 * `players`, so they can be corrected whichever season is selected. The jersey
 * number is per season: in the selected season's squad it's that season's number
 * (read-only once the season is archived); otherwise it's the default they take
 * into the next season they join.
 */
export async function updatePlayer(id: string, data: PlayerDetailsInput) {
  const supabase = createClient()
  await requireAdmin(supabase)

  const fullName = data.full_name.trim().toUpperCase()
  if (!fullName) throw new Error('Full name is required.')
  if (data.jersey_number != null && (!Number.isInteger(data.jersey_number) || data.jersey_number < 0 || data.jersey_number > 99)) {
    throw new Error('Jersey number must be 0–99.')
  }

  const [{ data: current, error: readError }, user, season] = await Promise.all([
    supabase.from('players').select('email, role, auth_user_id').eq('id', id).single(),
    getRequestUser(),
    getSelectedSeason(),
  ])
  if (readError) throw new Error(readError.message)

  const email = normalizeEmail(data.email)
  if (current.auth_user_id && email !== current.email) {
    throw new Error('They already have an account — their login email can’t be changed here.')
  }
  if (current.auth_user_id && current.auth_user_id === user?.id && data.role !== current.role) {
    throw new Error('You can’t change your own role.')
  }

  // "All time" isn't a season: the jersey field is then their default number
  const { data: entry, error: entryError } = season.allTime
    ? { data: null, error: null }
    : await supabase
        .from('season_players')
        .select('player_id')
        .eq('season_id', season.id)
        .eq('player_id', id)
        .maybeSingle()
  if (entryError) throw new Error(entryError.message)

  // players.jersey_number is the default carried into new seasons: set it when
  // they're not in the selected season, or when editing the current season.
  const setDefaultJersey = !entry || (!season.locked && season.is_current)
  const { error } = await supabase
    .from('players')
    .update({
      full_name: fullName,
      preferred_name: data.preferred_name?.trim().toUpperCase() || null,
      email,
      role: data.role,
      position: data.position && data.position.length > 0 ? data.position : null,
      date_of_birth: data.date_of_birth || null,
      is_active: data.is_active,
      ...(setDefaultJersey ? { jersey_number: data.jersey_number } : {}),
    })
    .eq('id', id)
  if (error) throw new Error(friendlyPlayerError(error.message, error.code))

  if (entry && !season.locked) {
    const { error: squadError } = await supabase
      .from('season_players')
      .update({ jersey_number: data.jersey_number })
      .eq('season_id', season.id)
      .eq('player_id', id)
    if (squadError) throw new Error(squadError.message)
  }

  revalidateSquad()
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
 * season's squad, with their latest jersey number, and make sure
 * they're active so they show in the squad.
 */
export async function addPlayersToSeason(playerIds: string[]) {
  const supabase = createClient()
  await requireAdmin(supabase)
  const season = await requireOpenSeason()
  if (playerIds.length === 0) return

  const { data: players, error } = await supabase
    .from('players')
    .select('id, jersey_number')
    .in('id', playerIds)
  if (error) throw new Error(error.message)

  const { error: squadError } = await supabase.from('season_players').upsert(
    (players ?? []).map((p) => ({
      season_id: season.id,
      player_id: p.id,
      jersey_number: p.jersey_number,
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

/**
 * Give a pending player (added without an email) their email, which unlocks the
 * invite link. Only before they have an account — changing the login email of an
 * existing account isn't done from here.
 */
export async function setPlayerEmail(playerId: string, email: string) {
  const supabase = createClient()
  await requireAdmin(supabase)

  const normalized = normalizeEmail(email)
  if (!normalized) throw new Error('Enter an email address.')

  const { data: player, error: readError } = await supabase
    .from('players')
    .select('auth_user_id')
    .eq('id', playerId)
    .single()
  if (readError) throw new Error(readError.message)
  if (player.auth_user_id) throw new Error('They already have an account — their login email can’t be changed here.')

  const { error } = await supabase.from('players').update({ email: normalized }).eq('id', playerId)
  if (error) throw new Error(friendlyPlayerError(error.message, error.code))

  revalidateSquad()
}

/**
 * Set (or clear) a player's photo — the path of an object the admin just
 * uploaded to the player-photos bucket. The previous photo's object is deleted.
 */
export async function setPlayerPhoto(playerId: string, path: string | null) {
  const supabase = createClient()
  await requireAdmin(supabase)
  if (path && !path.startsWith(`${playerId}/`)) throw new Error('That photo belongs to another player.')

  const { data: current, error: readError } = await supabase.from('players').select('photo_path').eq('id', playerId).single()
  if (readError) throw new Error(readError.message)

  const { error } = await supabase.from('players').update({ photo_path: path }).eq('id', playerId)
  if (error) throw new Error(error.message)

  if (current.photo_path && current.photo_path !== path) {
    await supabase.storage.from('player-photos').remove([current.photo_path])
  }
  revalidateSquad()
  revalidatePath('/admin/profile')
  revalidatePath('/dashboard/profile')
}
