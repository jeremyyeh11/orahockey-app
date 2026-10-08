'use client'

import { useState, useTransition } from 'react'
import { setAttendance } from '@/app/dashboard/schedule/actions'
import type { MyStatus } from '@/components/EventRow'

const CHOICES = [
  ['attending', "I'm in"],
  ['maybe', 'Maybe'],
  ['not_attending', 'Out'],
] as const

/**
 * I'm in / Maybe / Out on a Home Next up card — the same RSVP as the schedule.
 * Shows the pick straight away and puts it back if saving fails. `onAccent` styles
 * it for the green featured card. Sits above the card's stretched details link.
 */
export default function HomeRsvp({
  sessionId,
  kind,
  status,
  onAccent,
}: {
  sessionId: string
  kind: 'game' | 'training' | 'event'
  status: MyStatus | null
  onAccent: boolean
}) {
  const [mine, setMine] = useState<MyStatus | null>(status)
  const [isPending, startTransition] = useTransition()

  function respond(next: MyStatus) {
    const prev = mine
    setMine(next)
    startTransition(async () => {
      try {
        await setAttendance(sessionId, kind, next)
      } catch (err) {
        console.error(err)
        setMine(prev)
      }
    })
  }

  return (
    <div className="liga-home-rsvp relative z-10 mt-4 flex gap-2 lg:max-w-sm">
      {CHOICES.map(([choice, label]) => (
        <button
          key={choice}
          type="button"
          onClick={() => respond(choice)}
          disabled={isPending}
          aria-pressed={mine === choice}
          className={`liga-button flex-1 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-60 ${
            onAccent ? ACCENT[mine === choice ? choice : 'idle'] : PLAIN[mine === choice ? choice : 'idle']
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// On the green card: white for "I'm in" so it still stands out on green
const ACCENT: Record<MyStatus | 'idle', string> = {
  attending: 'bg-white text-brand-dark',
  maybe: 'bg-amber-300 text-amber-950',
  not_attending: 'bg-black/35 text-white',
  idle: 'border border-white/25 text-white/85 hover:bg-white/10 hover:text-white',
}

// On a grey card: the schedule's colours
const PLAIN: Record<MyStatus | 'idle', string> = {
  attending: 'bg-accent text-white ring-1 ring-white/10',
  maybe: 'bg-amber-900/60 text-amber-300',
  not_attending: 'bg-slate-700 text-slate-300',
  idle: 'border border-surface-border text-slate-400 hover:text-white',
}
