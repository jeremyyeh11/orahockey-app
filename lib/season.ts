// Season types + cookie name, shared by server pages and client components.
// Server-side loaders live in lib/season-server.ts.

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
}

export function lockedSeasonMessage(label: string) {
  return `Season ${label} is archived — past seasons are read-only.`
}
