'use client'

import { useState, useTransition } from 'react'
import { votePoll } from './actions'
import { fmtDateTime } from '@/lib/format'

export type Poll = {
  id: string
  question: string
  is_active: boolean
  closes_at: string | null
  created_at: string
  poll_options: { id: string; label: string; sort_order: number }[]
  poll_votes: { id: string; poll_option_id: string; player_id: string }[]
}

export default function PollsClient({ polls, myPlayerId }: { polls: Poll[]; myPlayerId: string | null }) {
  const open = polls.filter(
    (p) => p.is_active && (!p.closes_at || new Date(p.closes_at).getTime() > Date.now())
  )
  const closed = polls.filter((p) => !open.includes(p))

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-white">Polls</h1>

      {polls.length === 0 && (
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
                    className={`h-full rounded-full ${isMine ? 'bg-brand-light' : 'bg-brand-light/50'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
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
