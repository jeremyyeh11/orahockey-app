import { fmtDateTime } from '@/lib/format'
import { FINE_AMOUNT } from '@/lib/fines'

const DAY = 24 * 60 * 60 * 1000

/**
 * "Reply by Thu 15 Oct · 23:59" for someone who hasn't replied yet — on schedule
 * cards, Home's Next up cards and poll cards. Amber in the last 24 hours, red
 * once overdue; mentions the fine when fines are on. Renders nothing without a
 * deadline. `onAccent` is for the green featured card.
 */
export function RespondBy({
  respondBy,
  finesEnabled,
  now,
  onAccent = false,
  className = '',
}: {
  respondBy: string | null | undefined
  finesEnabled: boolean | undefined
  now: string | Date
  onAccent?: boolean
  className?: string
}) {
  if (!respondBy) return null
  const left = new Date(respondBy).getTime() - new Date(now).getTime()
  const when = fmtDateTime(respondBy)
  const fine = finesEnabled ? ` · $${FINE_AMOUNT} fine` : ''
  const state = left <= 0 ? 'overdue' : left <= DAY ? 'soon' : 'open'
  const tone = onAccent
    ? state === 'open'
      ? 'text-white/85'
      : 'font-semibold text-white'
    : state === 'overdue'
    ? 'text-red-400'
    : state === 'soon'
    ? 'text-amber-400'
    : 'text-slate-400'
  return (
    <div className={`liga-respond-by liga-meta ${tone} ${className}`} data-state={state}>
      {state === 'overdue' ? `Reply overdue — was due ${when}${fine}` : `Reply by ${when}${finesEnabled ? ` · $${FINE_AMOUNT} fine if late` : ''}`}
    </div>
  )
}
