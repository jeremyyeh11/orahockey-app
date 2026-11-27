// What's new: the release notes shown once to each player after an update
// (components/onboarding/WhatsNew.tsx). Every major feature PR adds a release
// here, newest first, with phone screenshots in public/whats-new/<release id>/
// (scripts/whats-new-shots.cjs takes them). A test checks the shape and that
// every image exists. A plain module: client components import it.

export type WhatsNewItem = {
  title: string
  /** One or two short sentences: what it is and how to use it */
  body: string
  /** /whats-new/<release id>/<name>.png — a 390×844 phone screenshot taken at 2x */
  image?: string
  /** Only admins see it (scheduling, squad edits, ...) */
  adminOnly?: boolean
  /** A button under the text that starts the tour */
  action?: 'tour'
}

export type Release = {
  /** Unique and never changed: players' seen state points at it. "YYYY-MM-short-name" */
  id: string
  /** YYYY-MM-DD it went live */
  date: string
  items: WhatsNewItem[]
}

export const RELEASES: Release[] = [
  {
    id: '2026-11-tour',
    date: '2026-11-27',
    items: [
      {
        title: 'Take the tour',
        body: 'A one-minute walk through the app: where to reply, vote and see your stats. Tap anywhere to move on.',
        image: '/whats-new/2026-11-tour/tour.png',
        action: 'tour',
      },
      {
        title: "What's new, after every update",
        body: "New features show up here the first time you open the app. See them again any time: Profile → What's new.",
        image: '/whats-new/2026-11-tour/profile.png',
      },
    ],
  },
]

export const LATEST_RELEASE_ID: string | null = RELEASES[0]?.id ?? null

/** Releases a modal can show at most at once, newest first */
const MAX_RELEASES = 3

/**
 * The releases this player hasn't seen yet, newest first, with admin-only
 * items dropped for players (and releases left empty by that dropped too).
 * `seen` null (never seen any) or an id no longer listed: just the latest.
 */
export function unseenReleases(seen: string | null, isAdmin: boolean): Release[] {
  const at = seen ? RELEASES.findIndex((r) => r.id === seen) : -1
  const fresh = at === -1 ? RELEASES.slice(0, 1) : RELEASES.slice(0, at)
  return fresh.slice(0, MAX_RELEASES).map((r) => forViewer(r, isAdmin)).filter((r) => r.items.length > 0)
}

/** Every release, newest first, for Profile → What's new */
export function allReleases(isAdmin: boolean): Release[] {
  return RELEASES.slice(0, MAX_RELEASES).map((r) => forViewer(r, isAdmin)).filter((r) => r.items.length > 0)
}

function forViewer(release: Release, isAdmin: boolean): Release {
  return { ...release, items: release.items.filter((i) => isAdmin || !i.adminOnly) }
}
