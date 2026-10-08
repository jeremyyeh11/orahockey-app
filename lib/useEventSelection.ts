'use client'

import { useState } from 'react'
import { eventId, type EventItem } from '@/components/EventRow'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery'

export const eventKey = (item: EventItem) => `${item.kind}-${eventId(item)}`

/**
 * Which schedule event's details are showing. Stored by key and looked up in the
 * current lists, so the details follow fresh data after an RSVP or save.
 *  - Touch layouts: nothing until a row is tapped (details open as a modal).
 *  - Desktop (lg+): the details panel always shows something — the picked event,
 *    else the next upcoming one, else the most recent past one.
 * A pick that a filter hides falls back to that default.
 *
 * `initialKey` (the schedule's `?event=` link, e.g. Home's "Open details") starts
 * with that event picked; closing it drops the parameter so a reload doesn't reopen it.
 */
export function useEventSelection(upcoming: EventItem[], past: EventItem[], initialKey: string | null = null) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [pickedKey, setPickedKey] = useState<string | null>(initialKey)

  const picked = pickedKey ? [...upcoming, ...past].find((i) => eventKey(i) === pickedKey) ?? null : null
  const selected = picked ?? (isDesktop ? upcoming[0] ?? past[0] ?? null : null)

  function select(item: EventItem | null) {
    setPickedKey(item ? eventKey(item) : null)
    const url = new URL(window.location.href)
    if (url.searchParams.has('event')) {
      url.searchParams.delete('event')
      window.history.replaceState(null, '', url)
    }
  }

  return {
    isDesktop,
    selected,
    select,
    isSelected: (item: EventItem) => isDesktop && !!selected && eventKey(selected) === eventKey(item),
  }
}
