'use client'

import { useState, useTransition } from 'react'
import { votePoll } from './actions'
import { fmtDateTime } from '@/lib/format'
import PotmPolls from '@/components/PotmPolls'
import { PollResults } from '@/components/PollResults'
import { RespondBy } from '@/components/RespondBy'
import { PollVoters } from '@/components/PollVoters'
import type { FineReason } from '@/lib/fines'
import type { PotmPoll } from '@/lib/potm'
import type { Poll } from '@/lib/polls'

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
  const open = polls.filter(
    (p) => p.is_active && (!p.closes_at || new Date(p.closes_at).getTime() > nowMs)
  )
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
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const total = poll.poll_votes.length
  const sorted = [...poll.poll_options].sort((a, b) => a.sort_order - b.sort_order)
  const myVote = myPlayerId
    ? poll.poll_votes.find((v) => v.player_id === myPlayerId)?.poll_option_id ?? null
    : null

  const showResults = !votable || myVote != null

  function handleVote() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      try {
        await votePoll(poll.id, selected)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="liga-poll-card card p-4">
      <div className="liga-poll-title text-sm font-semibold text-white">{poll.question}</div>
      <div className="liga-meta mt-0.5 text-slate-500">
        {total} vote{total === 1 ? '' : 's'}
        {poll.closes_at && ` · ${votable ? 'closes' : 'closed'} ${fmtDateTime(poll.closes_at)}`}
      </div>
      {votable && myVote == null && <RespondBy respondBy={poll.respond_by} finesEnabled={poll.fines_enabled} now={now} className="mt-0.5" />}

      {showResults ? (
        <PollResults poll={poll} myVote={myVote} mutedBarClass="bg-brand-light/50" />
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {sorted.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`liga-poll-option liga-button flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  selected === opt.id
                    ? 'border-brand bg-brand/10 text-white'
                    : 'border-surface-border text-slate-300 hover:border-slate-500'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected === opt.id ? 'border-brand-light' : 'border-slate-600'
                  }`}
                >
                  {selected === opt.id && <span className="h-2 w-2 rounded-full bg-brand-light" />}
                </span>
                {opt.label}
              </button>
            ))}
          </div>

          {error && <p className="liga-alert liga-alert-error mt-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleVote}
            disabled={!selected || isPending}
            className="liga-button liga-button-primary bg-accent mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
          >
            {isPending ? 'Voting…' : 'Vote'}
          </button>
        </>
      )}

      <PollVoters votes={poll.poll_votes} roster={roster} fined={fined} />
    </div>
  )
}
