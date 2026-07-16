import type { Poll } from '@/lib/polls'

/**
 * Result bars for a poll — one row per option with the vote count, percentage
 * and a fill bar. Shared by the admin and player poll cards. The muted (non-
 * selected) bar tint differs slightly between the two, so it's a prop.
 */
export function PollResults({
  poll,
  myVote,
  mutedBarClass,
}: {
  poll: Poll
  myVote: string | null
  mutedBarClass: string
}) {
  const total = poll.poll_votes.length
  const sorted = [...poll.poll_options].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="mt-3 space-y-2">
      {sorted.map((opt) => {
        const count = poll.poll_votes.filter((v) => v.poll_option_id === opt.id).length
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const isMine = myVote === opt.id
        return (
          <div key={opt.id}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className={isMine ? 'font-semibold text-brand-light' : 'text-slate-300'}>
                {opt.label}
                {isMine && ' · your vote'}
              </span>
              <span className="text-slate-500">
                {count} · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${isMine ? 'bg-brand-light' : mutedBarClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
