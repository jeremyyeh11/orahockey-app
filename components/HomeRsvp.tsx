'use client'

import { useState, useTransition } from 'react'
import { setAttendance } from '@/app/dashboard/schedule/actions'
import type { MyStatus } from '@/components/EventRow'
import { RsvpButtons } from '@/components/RsvpButtons'
import { OutReason } from '@/components/OutReason'
import { unwrap } from '@/lib/action-result'

/**
 * I'm in / Update later / Out on a Home Next up card — the same RSVP as the schedule.
 * Shows the pick straight away and puts it back if saving fails. `onAccent` styles
 * it for the green featured card. Sits above the card's stretched details link.
 * While the answer is Out, an optional reason box sits under the buttons.
 */
export default function HomeRsvp({
  sessionId,
  kind,
  status,
  reason,
  onAccent,
}: {
  sessionId: string
  kind: 'game' | 'training' | 'event'
  status: MyStatus | null
  reason: string | null
  onAccent: boolean
}) {
  const [mine, setMine] = useState<MyStatus | null>(status)
  const [isPending, startTransition] = useTransition()

  function respond(next: MyStatus) {
    const prev = mine
    setMine(next)
    startTransition(async () => {
      try {
        await unwrap(setAttendance(sessionId, kind, next))
      } catch (err) {
        console.error(err)
        setMine(prev)
      }
    })
  }

  return (
    <>
      <RsvpButtons value={mine} onPick={respond} disabled={isPending} onAccent={onAccent} className="liga-home-rsvp relative z-10 mt-4" />
      {mine === 'not_attending' && (
        <OutReason sessionId={sessionId} kind={kind} initial={reason} disabled={isPending} onAccent={onAccent} className="relative z-10 mt-2" />
      )}
    </>
  )
}
