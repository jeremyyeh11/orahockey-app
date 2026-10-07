'use client'

import { useState, useTransition } from 'react'
import { createPoll, setPollActive, deletePoll } from './actions'
import { votePoll } from '@/app/dashboard/polls/actions'
import { fmtDateTime, fromDatetimeLocal } from '@/lib/format'
import PotmPolls from '@/components/PotmPolls'
import { PollResults } from '@/components/PollResults'
import type { PotmPoll } from '@/lib/potm'
import type { Poll } from '@/lib/polls'
import Modal from '@/components/Modal'

const inputCls =
  'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
const dateInputCls = `${inputCls} h-[42px]`
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
    <div className="liga-page liga-polls p-4">
      {/* Header */}
      <div className="liga-page-header mb-4 flex items-end justify-between gap-3">
        <h1 className="liga-page-title text-white">Polls</h1>
        <button
          onClick={openModal}
          className="liga-button liga-button-primary bg-accent rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
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
          <h2 className="liga-section-title mb-2">Active</h2>
          <div className="liga-poll-list mb-6 space-y-0">
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
          <h2 className="liga-section-title mb-2">Closed</h2>
          <div className="liga-poll-list space-y-0">
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
        <Modal onClose={() => setShowModal(false)} scrollable>
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
              <input name="closes_at" type="datetime-local" className={dateInputCls} />
            </div>

            {error && <p className="liga-alert liga-alert-error rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

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
        </Modal>
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
    <div className="liga-poll-card card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="liga-poll-title text-sm font-semibold text-white">{poll.question}</div>
          <div className="liga-meta mt-0.5 text-slate-500">
            {total} vote{total === 1 ? '' : 's'}
            {poll.closes_at && ` · ${poll.is_active ? 'closes' : 'closed'} ${fmtDateTime(poll.closes_at)}`}
          </div>
        </div>
        {poll.is_active && (
          <span className="liga-status-label shrink-0 text-[10px] font-semibold uppercase text-green-300">
            Active
          </span>
        )}
      </div>

      {/* Result bars */}
      <PollResults poll={poll} myVote={myVote} mutedBarClass="bg-brand-light/80" />

      {/* Cast your own vote (admins are players too) */}
      {canVote && (
        <div className="liga-divider mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 text-xs font-medium text-slate-400">Your vote</div>
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`liga-poll-option liga-button rounded-full border px-3 py-1.5 text-xs font-medium transition ${
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
              className="liga-button liga-button-primary bg-accent rounded-full px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
            >
              {isVoting ? 'Voting…' : 'Vote'}
            </button>
          </div>
          {voteError && (
            <p className="liga-alert liga-alert-error mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-400">{voteError}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="liga-actions mt-4 flex gap-2 border-t border-white/5 pt-3">
        <button
          onClick={onToggle}
          disabled={isPending}
          className="liga-button liga-button-secondary rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
        >
          {poll.is_active ? 'Close poll' : 'Reopen'}
        </button>
        <button
          onClick={onDelete}
          disabled={isPending}
          className="liga-button liga-button-danger rounded-lg border border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-900/20 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
