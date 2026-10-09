'use client'

import { useState, useTransition } from 'react'
import { createPoll, setPollActive, deletePoll } from '@/app/admin/polls/actions'
import { fmtDateTime, fromDatetimeLocal } from '@/lib/format'
import PotmPolls from '@/components/PotmPolls'
import { PollOptions } from '@/components/PollOptions'
import type { PotmPoll } from '@/lib/potm'
import { isPollOpen, voterCount, type Poll } from '@/lib/polls'
import Modal from '@/components/Modal'
import { FinesFields, readFinesFields } from '@/components/FinesFields'
import { RespondBy } from '@/components/RespondBy'
import { PollVoters } from '@/components/PollVoters'
import type { FineReason } from '@/lib/fines'

const inputCls =
  'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
const dateInputCls = `${inputCls} h-[42px]`
const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

type Roster = { id: string; full_name: string; preferred_name: string | null }[]

/**
 * The Polls tab for both areas (PollsView loads it). Everyone votes and sees
 * who voted; admins also create, close/reopen and delete polls, always see the
 * results, and group polls by their Active flag rather than by open/closed.
 */
export default function PollsClient({
  polls,
  potmPolls,
  myPlayerId,
  now,
  roster,
  fined,
  isAdmin,
}: {
  polls: Poll[]
  potmPolls: PotmPoll[]
  myPlayerId: string | null
  now: string
  /** Who should vote: the current season's active squad */
  roster: Roster
  /** Unwaived fines per entry ('poll-<id>') and player */
  fined: Record<string, Record<string, FineReason[]>>
  isAdmin: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const [options, setOptions] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const nowMs = new Date(now).getTime()
  // Admins manage polls by their Active flag (Close poll / Reopen); players see what they can still vote on
  const isCurrent = (p: Poll) => (isAdmin ? p.is_active : isPollOpen(p, nowMs))
  const current = polls.filter(isCurrent)
  const closed = polls.filter((p) => !isCurrent(p))

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
        await createPoll(question, cleanOptions, closesRaw ? fromDatetimeLocal(closesRaw) : null, fd.get('multiple_choice') === 'on', readFinesFields(fd))
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

  const card = (poll: Poll) => (
    <PollCard
      key={poll.id}
      poll={poll}
      myPlayerId={myPlayerId}
      now={now}
      roster={roster}
      fined={fined[`poll-${poll.id}`]}
      admin={isAdmin ? { isPending, onToggle: () => handleToggle(poll), onDelete: () => handleDelete(poll) } : null}
    />
  )

  return (
    <div className="liga-page liga-polls p-4">
      {/* Header + new poll (admins) */}
      <div className="liga-page-header mb-4 flex items-end justify-between gap-3">
        <h1 className="liga-page-title text-white">Polls</h1>
        {isAdmin && (
          <button
            onClick={openModal}
            className="liga-button liga-button-primary bg-accent rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
          >
            + New Poll
          </button>
        )}
      </div>

      <PotmPolls polls={potmPolls} myPlayerId={myPlayerId} />

      {polls.length === 0 && potmPolls.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">{isAdmin ? 'No polls yet. Create one above.' : 'No polls yet.'}</p>
      )}

      {current.length > 0 && (
        <>
          <h2 className="liga-section-title mb-2">{isAdmin ? 'Active' : 'Open'}</h2>
          <div className="liga-poll-list mb-6 space-y-0">{current.map(card)}</div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="liga-section-title mb-2">Closed</h2>
          <div className="liga-poll-list space-y-0">{closed.map(card)}</div>
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
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-300">
                <input type="checkbox" name="multiple_choice" className="h-4 w-4 accent-brand" />
                Multiple answers
              </label>
            </div>

            <div>
              <label className={labelCls}>Closes at (optional)</label>
              <input name="closes_at" type="datetime-local" className={dateInputCls} />
            </div>

            <FinesFields kind="poll" closesName="closes_at" />

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
  now,
  roster,
  fined,
  admin,
}: {
  poll: Poll
  myPlayerId: string | null
  now: string
  roster: Roster
  fined?: Record<string, FineReason[]>
  /** Admin controls; null for players */
  admin: { isPending: boolean; onToggle: () => void; onDelete: () => void } | null
}) {
  const total = voterCount(poll.poll_votes)
  const open = isPollOpen(poll, new Date(now).getTime())
  const voted = myPlayerId != null && poll.poll_votes.some((v) => v.player_id === myPlayerId)

  return (
    <div className="liga-poll-card card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="liga-poll-title text-sm font-semibold text-white">{poll.question}</div>
          <div className="liga-meta mt-0.5 text-slate-500">
            {total} vote{total === 1 ? '' : 's'}
            {poll.multiple_choice && ' · multiple answers'}
            {poll.closes_at && ` · ${open ? 'closes' : 'closed'} ${fmtDateTime(poll.closes_at)}`}
          </div>
          {open && !voted && <RespondBy respondBy={poll.respond_by} finesEnabled={poll.fines_enabled} now={now} className="mt-0.5" />}
        </div>
        {admin && poll.is_active && (
          <span className="liga-status-label shrink-0 text-[10px] font-semibold uppercase text-green-300">
            Active
          </span>
        )}
      </div>

      {/* Results, and your own vote — tap an option (admins are players too, and always see results) */}
      <PollOptions
        poll={poll}
        myPlayerId={myPlayerId}
        open={open}
        alwaysShowResults={!!admin}
        mutedBarClass={admin ? 'bg-brand-light/80' : 'bg-brand-light/50'}
      />

      <PollVoters
        votes={poll.poll_votes}
        roster={roster}
        fined={fined}
        actions={
          admin && (
            <>
              <button
                onClick={admin.onToggle}
                disabled={admin.isPending}
                className="liga-button liga-button-secondary rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
              >
                {poll.is_active ? 'Close poll' : 'Reopen'}
              </button>
              <button
                onClick={admin.onDelete}
                disabled={admin.isPending}
                className="liga-button liga-button-danger rounded-lg border border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-900/20 disabled:opacity-40"
              >
                Delete
              </button>
            </>
          )
        }
      />
    </div>
  )
}
