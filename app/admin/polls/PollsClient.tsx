'use client'

import { useState, useTransition } from 'react'
import { createPoll, setPollActive, deletePoll } from './actions'
import { votePoll } from '@/app/dashboard/polls/actions'
import { fmtDateTime, fromDatetimeLocal } from '@/lib/format'
import PotmPolls from '@/components/PotmPolls'
import { PollResults } from '@/components/PollResults'
import type { PotmPoll } from '@/lib/potm'
import type { Poll } from '@/lib/polls'

const inputCls =
  'w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

export default function PollsClient({
  polls,
  potmPolls,
  myPlayerId,
}: {
  polls: Poll[]
  potmPolls: PotmPoll[]
  myPlayerId: string | null
}) {
  const [showModal, setShowModal] = useState(false)
  const [options, setOptions] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const active = polls.filter((p) => p.is_active)
  const closed = polls.filter((p) => !p.is_active)

  function openModal() {
    setOptions(['', ''])
    setError(null)
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const question = (fd.get('question') as string).trim()
    const closesRaw = fd.get('closes_at') as string
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean)

    if (cleanOptions.length < 2) {
      setError('Add at least two options.')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await createPoll(question, cleanOptions, closesRaw ? fromDatetimeLocal(closesRaw) : null)
        setShowModal(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleToggle(poll: Poll) {
    startTransition(async () => {
      await setPollActive(poll.id, !poll.is_active)
    })
  }

  function handleDelete(poll: Poll) {
    if (!confirm(`Delete "${poll.question}" and all its votes?`)) return
    startTransition(async () => {
      await deletePoll(poll.id)
    })
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Polls</h1>
        <button
          onClick={openModal}
          className="bg-accent rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
        >
          + New Poll
        </button>
      </div>

      <PotmPolls polls={potmPolls} myPlayerId={myPlayerId} />

      {polls.length === 0 && potmPolls.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">No polls yet. Create one above.</p>
      )}

      {active.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">Active</h2>
          <div className="mb-6 space-y-3">
            {active.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                myPlayerId={myPlayerId}
                isPending={isPending}
                onToggle={() => handleToggle(poll)}
                onDelete={() => handleDelete(poll)}
              />
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">Closed</h2>
          <div className="space-y-3">
            {closed.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                myPlayerId={myPlayerId}
                isPending={isPending}
                onToggle={() => handleToggle(poll)}
                onDelete={() => handleDelete(poll)}
              />
            ))}
          </div>
        </>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)} />
          <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-card px-6 pb-8 pt-6 shadow-xl sm:max-w-sm sm:rounded-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
            <h2 className="mb-5 text-lg font-bold text-white">New Poll</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Question *</label>
                <input
                  name="question"
                  type="text"
                  required
                  className={inputCls}
                  placeholder="Which night should we train?"
                />
              </div>

              <div>
                <label className={labelCls}>Options *</label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) =>
                          setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                        }
                        className={inputCls}
                        placeholder={`Option ${i + 1}`}
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                          className="shrink-0 rounded-lg border border-surface-border px-3 text-slate-400 transition hover:text-white"
                          aria-label="Remove option"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => [...prev, ''])}
                    className="mt-2 text-xs font-medium text-brand-light transition hover:text-white"
                  >
                    + Add option
                  </button>
                )}
              </div>

              <div>
                <label className={labelCls}>Closes at (optional)</label>
                <input name="closes_at" type="datetime-local" className={inputCls} />
              </div>

              {error && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
                >
                  {isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PollCard({
  poll,
  myPlayerId,
  isPending,
  onToggle,
  onDelete,
}: {
  poll: Poll
  myPlayerId: string | null
  isPending: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isVoting, startVoting] = useTransition()

  const total = poll.poll_votes.length
  const sorted = [...poll.poll_options].sort((a, b) => a.sort_order - b.sort_order)
  const myVote = myPlayerId
    ? poll.poll_votes.find((v) => v.player_id === myPlayerId)?.poll_option_id ?? null
    : null
  const canVote = poll.is_active && myVote == null

  function handleVote() {
    if (!selected) return
    setVoteError(null)
    startVoting(async () => {
      try {
        await votePoll(poll.id, selected)
      } catch (err) {
        setVoteError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{poll.question}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {total} vote{total === 1 ? '' : 's'}
            {poll.closes_at && ` · ${poll.is_active ? 'closes' : 'closed'} ${fmtDateTime(poll.closes_at)}`}
          </div>
        </div>
        {poll.is_active && (
          <span className="shrink-0 rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-300">
            Active
          </span>
        )}
      </div>

      {/* Result bars */}
      <PollResults poll={poll} myVote={myVote} mutedBarClass="bg-brand-light/80" />

      {/* Cast your own vote (admins are players too) */}
      {canVote && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 text-xs font-medium text-slate-400">Your vote</div>
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selected === opt.id
                    ? 'border-brand bg-brand/20 text-white'
                    : 'border-surface-border text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={handleVote}
              disabled={!selected || isVoting}
              className="bg-accent rounded-full px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
            >
              {isVoting ? 'Voting…' : 'Vote'}
            </button>
          </div>
          {voteError && (
            <p className="mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-400">{voteError}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2 border-t border-white/5 pt-3">
        <button
          onClick={onToggle}
          disabled={isPending}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
        >
          {poll.is_active ? 'Close poll' : 'Reopen'}
        </button>
        <button
          onClick={onDelete}
          disabled={isPending}
          className="rounded-lg border border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-900/20 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
