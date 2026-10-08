// Season types + cookie name, shared by server pages and client components.
// Server-side loaders live in lib/season-server.ts.

import { LEAGUE } from '@/lib/constants'
import { toDatetimeLocal } from '@/lib/format'

/** Selected season label (e.g. "2026"). Session cookie: a fresh visit opens the current season. */
export const SEASON_COOKIE = 'ora-season'

export type Season = {
  id: string
  label: string
  starts_on: string
  ends_on: string
  is_current: boolean
  /** Past seasons are locked (shown as "Archived"): read-only in the app, editable only from the backend */
  locked: boolean
  /** The "All time" view: every season combined (not a database row) */
  allTime?: boolean
  /**
   * Which stats this season kept (migration 024): all five normally; 2024 only
   * goals + potm; 2025 none (appearances only). Undefined = all (e.g. All time).
   */
  recorded_stats?: string[]
  /** Set when the season never ran (migration 026), e.g. 'COVID-19'; null/undefined = a normal season */
  cancelled_reason?: string | null
}

export const RECORDABLE_STATS = ['goals', 'goal_types', 'assists', 'cards', 'potm'] as const
export type RecordedStat = (typeof RECORDABLE_STATS)[number]

/** The stats a season recorded */
export const recordedStats = (s: Pick<Season, 'recorded_stats'>): string[] => s.recorded_stats ?? [...RECORDABLE_STATS]
/** Whether a season recorded one stat — e.g. records(season, 'assists') */
export const records = (s: Pick<Season, 'recorded_stats'>, stat: RecordedStat) => recordedStats(s).includes(stat)
/** Anything beyond appearances (false = appearances only) */
export const statsRecorded = (s: Pick<Season, 'recorded_stats'>) => recordedStats(s).length > 0

/**
 * Pseudo-season for the switcher's "All time" option: every season combined.
 * View-only (locked), since changes always belong to one season. Its label is
 * the cookie value; display it with seasonTitle().
 */
export const ALL_TIME: Season = {
  id: 'all',
  label: 'all',
  starts_on: '',
  ends_on: '',
  is_current: false,
  locked: true,
  allTime: true,
}

/** Display name: "MHL1 2027", or "All time" */
export function seasonTitle(s: Pick<Season, 'label' | 'allTime'>) {
  return s.allTime ? 'All time' : `${LEAGUE} ${s.label}`
}

export function lockedSeasonMessage(season: Pick<Season, 'label' | 'allTime'>) {
  return season.allTime
    ? 'All time is view-only — pick a season to make changes.'
    : `Season ${season.label} is archived — past seasons are read-only.`
}

export type SeasonPhase = 'pre-season' | 'season' | 'post-season'

export const PHASE_LABEL: Record<SeasonPhase, string> = {
  'pre-season': 'Pre-season',
  season: 'Season',
  'post-season': 'Post-season',
}

/** Singapore calendar day, 'YYYY-MM-DD' */
const sgDay = (iso: string) => toDatetimeLocal(iso).slice(0, 10)

/**
 * Where a season is, from its fixtures (games) and today — never stored:
 *   no fixtures, or before the first fixture's day → pre-season
 *   from the first to the last fixture's day        → season
 *   after the last fixture's day                     → post-season
 */
export function seasonPhase(fixtureDates: string[], now: Date): SeasonPhase {
  if (fixtureDates.length === 0) return 'pre-season'
  const days = fixtureDates.map(sgDay).sort()
  const today = sgDay(now.toISOString())
  if (today < days[0]) return 'pre-season'
  if (today > days[days.length - 1]) return 'post-season'
  return 'season'
}

/** The season after a year-labelled one ('2027' → '2028'); null if the label isn't a year */
export function nextSeasonLabel(label: string): string | null {
  return /^\d{4}$/.test(label) ? String(Number(label) + 1) : null
}
