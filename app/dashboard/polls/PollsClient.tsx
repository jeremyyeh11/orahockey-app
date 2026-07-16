'use client'

import { useState, useTransition } from 'react'
import { votePoll } from './actions'
import { fmtDateTime } from '@/lib/format'
import PotmPolls from '@/components/PotmPolls'
import { PollResults } from '@/components/PollResults'
import type { PotmPoll } from '@/lib/potm'
import type { Poll } from '@/lib/polls'

export default function PollsClient({
  polls,
  potmPolls,
  myPlayerId,
  now,
}: {
  polls: Poll[]
  potmPolls: PotmPoll[]
  myPlayerId: string | null
  now: string
}) {
  const nowMs = new Date(now).getTime()
  const open = polls.filter(
    (p) => p.is_active && (!p.closes_at || new Date(p.closes_at).getTime() > nowMs)
  )
  const closed = polls.filter((p) => !open.includes(p))

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-white">Polls</h1>

      <PotmPolls polls={potmPolls} myPlayerId={myPlayerId} />

      {polls.length === 0 && potmPolls.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">No polls yet.</p>
      )}

      {open.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">Open</h2>
          <div className="mb-6 space-y-3">
            {open.map((poll) => (
              <PollCard key={poll.id} poll={poll} myPlayerId={myPlayerId} votable />
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">Closed</h2>
          <div className="space-y-3">
            {closed.map((poll) => (
              <PollCard key={poll.id} poll={poll} myPlayerId={myPlayerId} />
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
  votable = false,
}: {
  poll: Poll
  myPlayerId: string | null
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
    <div className="card p-4">
      <div className="text-sm font-semibold text-white">{poll.question}</div>
      <div className="mt-0.5 text-xs text-slate-500">
        {total} vote{total === 1 ? '' : 's'}
        {poll.closes_at && ` · ${votable ? 'closes' : 'closed'} ${fmtDateTime(poll.closes_at)}`}
      </div>

      {showResults ? (
        <PollResults poll={poll} myVote={myVote} mutedBarClass="bg-brand-light/50" />
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {sorted.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
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

          {error && <p className="mt-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleVote}
            disabled={!selected || isPending}
            className="bg-accent mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
          >
            {isPending ? 'Voting…' : 'Vote'}
          </button>
        </>
      )}
    </div>
  )
}
