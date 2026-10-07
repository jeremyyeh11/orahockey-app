'use client'

import { useState } from 'react'
import type { EventItem } from '@/components/EventRow'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery'

export const eventKey = (item: EventItem) =>
  item.kind === 'game' ? `game-${item.game.id}` : `training-${item.training.id}`

/**
 * Which schedule event's details are showing. Stored by key and looked up in the
 * current lists, so the details follow fresh data after an RSVP or save.
 *  - Touch layouts: nothing until a row is tapped (details open as a modal).
 *  - Desktop (lg+): the details panel always shows something — the picked event,
 *    else the next upcoming one, else the most recent past one.
 * A pick that a filter hides falls back to that default.
 */
export function useEventSelection(upcoming: EventItem[], past: EventItem[]) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [pickedKey, setPickedKey] = useState<string | null>(null)

  const picked = pickedKey ? [...upcoming, ...past].find((i) => eventKey(i) === pickedKey) ?? null : null
  const selected = picked ?? (isDesktop ? upcoming[0] ?? past[0] ?? null : null)

  return {
    isDesktop,
    selected,
    select: (item: EventItem | null) => setPickedKey(item ? eventKey(item) : null),
    isSelected: (item: EventItem) => isDesktop && !!selected && eventKey(selected) === eventKey(item),
  }
}
