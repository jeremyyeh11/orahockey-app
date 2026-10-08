'use client'

import { useEffect, useState } from 'react'
import { fmtDateTime } from '@/lib/format'
import { FINE_AMOUNT } from '@/lib/fines'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** '45m' · '5h 20m' · '1d 5h' · '9 days' */
export function fmtCountdown(ms: number) {
  const abs = Math.abs(ms)
  if (abs < HOUR) return `${Math.max(1, Math.floor(abs / MIN))}m`
  if (abs < DAY) return `${Math.floor(abs / HOUR)}h ${Math.floor((abs % HOUR) / MIN)}m`
  if (abs < 3 * DAY) return `${Math.floor(abs / DAY)}d ${Math.floor((abs % DAY) / HOUR)}h`
  return `${Math.floor(abs / DAY)} days`
}

/**
 * Where a schedule row shows its reply countdown, as a class for <RespondBy>: null = not at
 * all. Wide screens keep the old rule (until you reply — the details panel sits beside the
 * list and covers the rest). Touch layouts also show it after you reply, but only for the
 * first event with an open deadline or once under 48h, so the list stays clean; an overdue,
 * unreplied one always shows.
 */
export function rowCountdownClass({
  respondBy,
  replied,
  now,
  first,
}: {
  respondBy: string | null | undefined
  replied: boolean
  now: string | Date
  /** The first upcoming event with an open deadline */
  first: boolean
}): string | null {
  if (!respondBy) return null
  const left = new Date(respondBy).getTime() - new Date(now).getTime()
  const wide = !replied
  const touch = left <= 0 ? !replied : first || left < 2 * DAY
  if (wide && touch) return ''
  if (touch) return 'lg:hidden'
  if (wide) return 'hidden lg:block'
  return null
}

/**
 * For someone who hasn't replied yet — schedule rows, Home's Next up cards and
 * poll cards: a countdown ("1d 5h left", amber in the last 24h, red "Overdue by
 * 3h") over the actual deadline and the fine. Ticks every 30s from the page's
 * `now` (so the admin preview date still applies). Nothing without a deadline.
 * `onAccent` is for the green featured card.
 */
export function RespondBy({
  respondBy,
  finesEnabled,
  now,
  onAccent = false,
  countdownOnly = false,
  className = '',
}: {
  respondBy: string | null | undefined
  finesEnabled: boolean | undefined
  now: string | Date
  onAccent?: boolean
  /** Just the countdown line (the event details show the deadline in their own row) */
  countdownOnly?: boolean
  className?: string
}) {
  const start = new Date(now).getTime()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const mounted = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - mounted), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!respondBy) return null
  const left = new Date(respondBy).getTime() - (start + elapsed)
  const state = left <= 0 ? 'overdue' : left <= DAY ? 'soon' : 'open'
  const countdownTone = onAccent
    ? 'text-white'
    : state === 'overdue'
    ? 'text-red-400'
    : state === 'soon'
    ? 'text-amber-300'
    : 'text-slate-100'
  const detailTone = onAccent ? 'text-white/80' : 'text-slate-400'
  const due = fmtDateTime(respondBy)

  return (
    <div className={`liga-respond-by ${className}`} data-state={state}>
      <div className={`liga-respond-countdown text-sm font-semibold leading-tight ${countdownTone}`}>
        {state === 'overdue' ? `Reply overdue by ${fmtCountdown(left)}` : `${fmtCountdown(left)} left to reply`}
      </div>
      {!countdownOnly && (
        <div className={`liga-meta mt-0.5 ${detailTone}`}>
          {state === 'overdue' ? `Was due ${due}` : `Reply by ${due}`}
          {finesEnabled ? ` · $${FINE_AMOUNT} fine${state === 'overdue' ? '' : ' if late reply'}` : ''}
        </div>
      )}
    </div>
  )
}
