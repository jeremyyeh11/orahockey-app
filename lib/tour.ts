// The first-time tour (components/onboarding/Tour.tsx): a spotlight on one
// part of Home at a time, with a short caption. `target` matches a
// data-tour="..." attribute; a step whose target isn't on the page (no
// seasons yet, say) is skipped, and a step without one is a centred card.
// A plain module: client components import it.

/** Profile's "Replay tour" / "What's new" buttons dispatch these; components/onboarding/Onboarding.tsx listens */
export const START_TOUR_EVENT = 'ora:start-tour'
export const OPEN_WHATS_NEW_EVENT = 'ora:whats-new'

export type TourStep = {
  target?: string
  title: string
  body: string
  /** Admins read this instead of `body` */
  adminBody?: string
  adminOnly?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to ORA Hockey',
    body: 'A one-minute look around. Tap anywhere to go to the next step.',
  },
  {
    target: 'admin-badge',
    adminOnly: true,
    title: 'Admin area',
    body: 'You manage the team from the same six tabs. Admins are players too: reply and vote as normal.',
  },
  {
    target: 'next-up',
    title: 'Next up',
    body: 'Your next game, training or event. Reply In, Out or Update later before the respond-by time. Late replies can be fined.',
  },
  {
    target: 'season',
    title: 'Seasons',
    body: 'Pick a season. Home, Schedule and Squad follow it.',
  },
  {
    target: 'nav-schedule',
    title: 'Schedule',
    body: "Every game, training and event. Tap one for details, the team list and who's coming.",
    adminBody: 'Every game, training and event. Add new ones here; open one to edit it or post the team list.',
  },
  {
    target: 'nav-polls',
    title: 'Polls',
    body: 'Team polls and Player of the Match votes.',
    adminBody: 'Team polls and Player of the Match votes. Create polls here.',
  },
  {
    target: 'nav-squad',
    title: 'Squad',
    body: "Everyone's stats. Tap a player for their profile.",
    adminBody: "Everyone's stats. Add players and send app invites here.",
  },
  {
    target: 'nav-fines',
    title: 'Fines',
    body: 'What you owe and why.',
  },
  {
    target: 'nav-profile',
    title: 'Profile',
    body: "Your stats by season. Edit your name, positions and photo. Replay this tour or see What's new here.",
  },
  {
    title: "You're all set",
    body: 'See you at the next game.',
  },
]

/** The steps for this viewer, with admin captions swapped in */
export function tourSteps(isAdmin: boolean): TourStep[] {
  return TOUR_STEPS.filter((s) => isAdmin || !s.adminOnly).map((s) => (isAdmin && s.adminBody ? { ...s, body: s.adminBody } : s))
}
