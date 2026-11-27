// What's new: the release notes shown once to each player after an update
// (components/onboarding/WhatsNew.tsx). Every major feature PR adds a release
// here, newest first, with phone screenshots in public/whats-new/<release id>/
// (scripts/whats-new-shots.cjs takes them). A test checks the shape and that
// every image exists. A plain module: client components import it.

export type WhatsNewItem = {
  title: string
  /** One or two short sentences: what it is and how to use it */
  body: string
  /** /whats-new/<release id>/<name>.png — a 390px-wide phone screenshot taken at 2x */
  image: string
  /** Only these viewers see it: admins, or whoever manages fines (Finemaster title / superadmin) */
  only?: 'admin' | 'fines'
}

export type Release = {
  /** Unique and never changed: players' seen state points at it. "YYYY-MM-short-name" */
  id: string
  /** YYYY-MM-DD it went live */
  date: string
  items: WhatsNewItem[]
}

/** Who's looking: decides which `only` items they get */
export type WhatsNewViewer = { isAdmin: boolean; fineManager: boolean }

export const RELEASES: Release[] = [
  {
    id: '2026-11-fines',
    date: '2026-11-27',
    items: [
      {
        title: 'What you owe, all months',
        body: 'The Fines card now shows All months: everything still owed. Copy all outstanding for WhatsApp copies each player’s total.',
        image: '/whats-new/2026-11-fines/all-months.png',
      },
      {
        title: 'Add a fine by hand',
        body: '+ Fine → pick the player and Date incurred (backdate if needed), then tap a reason like Late arrival or No-show. Edit the text to fit.',
        image: '/whats-new/2026-11-fines/add-fine.png',
        only: 'fines',
      },
      {
        title: 'Delete a mistake',
        body: 'Delete on a fine removes it for everyone, as if never charged. To excuse a fine but keep it on record, use Waive.',
        image: '/whats-new/2026-11-fines/delete.png',
        only: 'fines',
      },
    ],
  },
]

export const LATEST_RELEASE_ID: string | null = RELEASES[0]?.id ?? null

/** Releases a modal can show at most at once, newest first */
const MAX_RELEASES = 3

/**
 * The releases this player hasn't seen yet, newest first, without items meant
 * for others (and releases left empty by that).
 * `seen` null (never seen any) or an id no longer listed: just the latest.
 */
export function unseenReleases(seen: string | null, viewer: WhatsNewViewer): Release[] {
  const at = seen ? RELEASES.findIndex((r) => r.id === seen) : -1
  const fresh = at === -1 ? RELEASES.slice(0, 1) : RELEASES.slice(0, at)
  return fresh.slice(0, MAX_RELEASES).map((r) => forViewer(r, viewer)).filter((r) => r.items.length > 0)
}

/** The recent releases, newest first, for Profile → What's new */
export function allReleases(viewer: WhatsNewViewer): Release[] {
  return RELEASES.slice(0, MAX_RELEASES).map((r) => forViewer(r, viewer)).filter((r) => r.items.length > 0)
}

function forViewer(release: Release, viewer: WhatsNewViewer): Release {
  const sees = (item: WhatsNewItem) =>
    !item.only || (item.only === 'admin' ? viewer.isAdmin : viewer.fineManager)
  return { ...release, items: release.items.filter(sees) }
}
