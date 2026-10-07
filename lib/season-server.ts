import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SEASON_COOKIE, lockedSeasonMessage, type Season } from '@/lib/season'

/** All seasons, newest first. Deduped per request. */
export const getSeasons = cache(async (): Promise<Season[]> => {
  const { data, error } = await createClient()
    .from('seasons')
    .select('id, label, starts_on, ends_on, is_current, locked')
    .order('starts_on', { ascending: false })
  if (error) throw new Error(`Error loading seasons: ${error.message}`)
  return (data ?? []) as Season[]
})

/**
 * The season the app is showing: the one picked in the season switcher (cookie),
 * else the current season. An unknown or stale cookie falls back to current.
 */
export const getSelectedSeason = cache(async (): Promise<Season> => {
  const seasons = await getSeasons()
  const wanted = cookies().get(SEASON_COOKIE)?.value
  const season = seasons.find((s) => s.label === wanted) ?? seasons.find((s) => s.is_current) ?? seasons[0]
  if (!season) throw new Error('No seasons set up yet.')
  return season
})

/** Props for the season switcher in the app shell; null when there's nothing to switch. */
export async function getSeasonNav(): Promise<{ seasons: Season[]; selectedId: string } | null> {
  try {
    const seasons = await getSeasons()
    if (seasons.length === 0) return null
    return { seasons, selectedId: (await getSelectedSeason()).id }
  } catch {
    // Signed out (RLS hides seasons) or seasons unavailable — render the shell without a switcher
    return null
  }
}

/**
 * For server actions that create season data: the selected season, or a friendly
 * error when it's locked. (The database's season_lock trigger is the real guard.)
 */
export async function requireOpenSeason(): Promise<Season> {
  const season = await getSelectedSeason()
  if (season.locked) throw new Error(lockedSeasonMessage(season.label))
  return season
}

export type SquadMember = {
  id: string
  full_name: string
  preferred_name: string | null
  jersey_number: number | null
  position: string[] | null
  is_active: boolean
}

/**
 * The schedule's roster (attendance breakdown, team lists, scorers): the
 * season's squad by name — everyone for a past season, active players for an
 * open one.
 */
export function seasonRoster(squad: SquadMember[], locked: boolean) {
  return squad
    .filter((p) => locked || p.is_active)
    .map(({ id, full_name, preferred_name, position, jersey_number }) => ({ id, full_name, preferred_name, position, jersey_number }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

/**
 * A season's squad: its season_players rows joined to players, with that
 * season's jersey number and position. `fields` adds extra players columns.
 * Sorted by jersey number, then name.
 */
export async function getSeasonSquad<T extends SquadMember = SquadMember>(
  seasonId: string,
  fields = ''
): Promise<T[]> {
  const base = 'id, full_name, preferred_name, is_active'
  const { data, error } = await createClient()
    .from('season_players')
    .select(`jersey_number, position, player:players!inner(${fields ? `${base}, ${fields}` : base})`)
    .eq('season_id', seasonId)
  if (error) throw new Error(`Error loading squad: ${error.message}`)

  const rows = (data ?? []) as unknown as {
    jersey_number: number | null
    position: string[] | null
    player: Record<string, unknown>
  }[]
  return rows
    .map((r) => ({ ...r.player, jersey_number: r.jersey_number, position: r.position }) as unknown as T)
    .sort(
      (a, b) =>
        (a.jersey_number ?? Infinity) - (b.jersey_number ?? Infinity) ||
        a.full_name.localeCompare(b.full_name)
    )
}
