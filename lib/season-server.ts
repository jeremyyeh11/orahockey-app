import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ALL_TIME, SEASON_COOKIE, lockedSeasonMessage, type Season } from '@/lib/season'

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
 * "All time" (ALL_TIME, `allTime: true`) has no database id: pages skip their
 * season_id filter for it (see inSeason).
 */
export const getSelectedSeason = cache(async (): Promise<Season> => {
  const seasons = await getSeasons()
  const wanted = cookies().get(SEASON_COOKIE)?.value
  if (wanted === ALL_TIME.label && seasons.length > 0) return ALL_TIME
  const season = seasons.find((s) => s.label === wanted) ?? seasons.find((s) => s.is_current) ?? seasons[0]
  if (!season) throw new Error('No seasons set up yet.')
  return season
})

/** Props for the season switcher in the app shell; null when there's nothing to switch. */
export async function getSeasonNav(): Promise<{ seasons: Season[]; selectedId: string } | null> {
  try {
    const seasons = await getSeasons()
    if (seasons.length === 0) return null
    // "All time" first, so it stays on top as seasons stack up (newest season next)
    return { seasons: [ALL_TIME, ...seasons], selectedId: (await getSelectedSeason()).id }
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
  if (season.locked) throw new Error(lockedSeasonMessage(season))
  return season
}

/**
 * Filter a Supabase query to the season, or leave it unfiltered for "All time".
 * (Unconstrained generic on purpose: constraining Q against Supabase's builder
 * types trips TypeScript's instantiation-depth limit on long selects.)
 */
export function inSeason<Q>(query: Q, season: Season, column = 'season_id'): Q {
  return season.allTime ? query : (query as unknown as { eq(column: string, value: string): Q }).eq(column, season.id)
}

/**
 * Whether a player has anything on record in a season — stats, POTM, cards, a
 * team-list selection or an appearance in a played game. Season leaderboards
 * only count squad members, so removing such a player from the squad would drop
 * their numbers; they should be marked inactive instead.
 */
export async function hasSeasonRecord(seasonId: string, playerId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: games, error } = await supabase.from('games').select('id, result').eq('season_id', seasonId)
  if (error) throw new Error(error.message)
  const gameIds = (games ?? []).map((g) => g.id)
  const playedIds = (games ?? []).filter((g) => g.result).map((g) => g.id)
  if (gameIds.length === 0) return false

  const count = (table: string) =>
    supabase.from(table).select('*', { count: 'exact', head: true }).in('game_id', gameIds)
  const results = await Promise.all([
    count('player_stats').eq('player_id', playerId),
    count('potm').eq('player_id', playerId),
    count('match_cards').eq('player_id', playerId),
    count('match_team_lists').eq('player_id', playerId).eq('selected', true),
    playedIds.length
      ? supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', playerId)
          .eq('session_type', 'game')
          .eq('status', 'attending')
          .in('session_id', playedIds)
      : Promise.resolve({ count: 0, error: null }),
  ])
  for (const r of results) if (r.error) throw new Error(r.error.message)
  return results.some((r) => (r.count ?? 0) > 0)
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
 * season's jersey number (positions are per player). `fields` adds extra
 * players columns. For "All time" (ALL_TIME.id): everyone who's been in any
 * season's squad, once each, with their latest jersey number.
 * Sorted by jersey number, then name.
 */
export async function getSeasonSquad<T extends SquadMember = SquadMember>(
  seasonId: string,
  fields = ''
): Promise<T[]> {
  const allTime = seasonId === ALL_TIME.id
  const base = `id, full_name, preferred_name, is_active, position${allTime ? ', jersey_number' : ''}`
  let query = createClient()
    .from('season_players')
    .select(`jersey_number, player:players!inner(${fields ? `${base}, ${fields}` : base})`)
  if (!allTime) query = query.eq('season_id', seasonId)
  const { data, error } = await query
  if (error) throw new Error(`Error loading squad: ${error.message}`)

  const rows = (data ?? []) as unknown as {
    jersey_number: number | null
    player: Record<string, unknown>
  }[]
  const members = allTime
    ? Array.from(new Map(rows.map((r) => [r.player.id as string, r.player])).values())
    : rows.map((r) => ({ ...r.player, jersey_number: r.jersey_number }))
  return (members as unknown as T[])
    .sort(
      (a, b) =>
        (a.jersey_number ?? Infinity) - (b.jersey_number ?? Infinity) ||
        a.full_name.localeCompare(b.full_name)
    )
}
