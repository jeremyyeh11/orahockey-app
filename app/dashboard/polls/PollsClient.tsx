'use client'

import { fmtDateTime } from '@/lib/format'
import PotmPolls from '@/components/PotmPolls'
import { PollOptions } from '@/components/PollOptions'
import { RespondBy } from '@/components/RespondBy'
import { PollVoters } from '@/components/PollVoters'
import type { FineReason } from '@/lib/fines'
import type { PotmPoll } from '@/lib/potm'
import { isPollOpen, voterCount, type Poll } from '@/lib/polls'

export default function PollsClient({
  polls,
  potmPolls,
  myPlayerId,
  now,
  roster,
  fined,
}: {
  polls: Poll[]
  potmPolls: PotmPoll[]
  myPlayerId: string | null
  now: string
  /** Who should vote: the current season's active squad */
  roster: { id: string; full_name: string; preferred_name: string | null }[]
  /** Unwaived fines per entry ('poll-<id>') and player */
  fined: Record<string, Record<string, FineReason[]>>
}) {
  const nowMs = new Date(now).getTime()
  const open = polls.filter((p) => isPollOpen(p, nowMs))
  const closed = polls.filter((p) => !open.includes(p))

  return (
    <div className="liga-page liga-polls p-4">
      <div className="liga-page-header mb-4">
        <h1 className="liga-page-title text-white">Polls</h1>
      </div>

      <PotmPolls polls={potmPolls} myPlayerId={myPlayerId} />

      {polls.length === 0 && potmPolls.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">No polls yet.</p>
      )}

      {open.length > 0 && (
        <>
          <h2 className="liga-section-title mb-2">Open</h2>
          <div className="liga-poll-list mb-6 space-y-0">
            {open.map((poll) => (
              <PollCard key={poll.id} poll={poll} myPlayerId={myPlayerId} now={now} roster={roster} fined={fined[`poll-${poll.id}`]} votable />
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="liga-section-title mb-2">Closed</h2>
          <div className="liga-poll-list space-y-0">
            {closed.map((poll) => (
              <PollCard key={poll.id} poll={poll} myPlayerId={myPlayerId} now={now} roster={roster} fined={fined[`poll-${poll.id}`]} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PollCard({
  poll,
  myPlayerId,
  now,
  roster,
  fined,
  votable = false,
}: {
  poll: Poll
  myPlayerId: string | null
  now: string
  roster: { id: string; full_name: string; preferred_name: string | null }[]
  fined?: Record<string, FineReason[]>
  votable?: boolean
}) {
  const total = voterCount(poll.poll_votes)
  const voted = myPlayerId != null && poll.poll_votes.some((v) => v.player_id === myPlayerId)

  return (
    <div className="liga-poll-card card p-4">
      <div className="liga-poll-title text-sm font-semibold text-white">{poll.question}</div>
      <div className="liga-meta mt-0.5 text-slate-500">
        {total} vote{total === 1 ? '' : 's'}
        {poll.multiple_choice && ' · multiple answers'}
        {poll.closes_at && ` · ${votable ? 'closes' : 'closed'} ${fmtDateTime(poll.closes_at)}`}
      </div>
      {votable && !voted && <RespondBy respondBy={poll.respond_by} finesEnabled={poll.fines_enabled} now={now} className="mt-0.5" />}

      <PollOptions poll={poll} myPlayerId={myPlayerId} open={votable} mutedBarClass="bg-brand-light/50" />

      <PollVoters votes={poll.poll_votes} roster={roster} fined={fined} />
    </div>
  )
}
