'use client'

import { useEffect, useState, useTransition } from 'react'
import { setPollVote } from '@/app/dashboard/polls/actions'
import { CheckIcon } from '@/components/icons'
import { voterCount, type Poll } from '@/lib/polls'

/**
 * A poll's options, Telegram-style: tap an option to vote — no Vote button.
 * One answer: tapping another option moves your vote, tapping yours retracts it.
 * Multiple answers: each tap adds or removes that option. "Retract vote" clears
 * everything while the poll is open. Results (count, % of voters, bar) show once
 * you've voted, when the poll is closed, or always with `alwaysShowResults`
 * (admins). Shared by the admin and player poll cards.
 */
export function PollOptions({
  poll,
  myPlayerId,
  open,
  alwaysShowResults = false,
  mutedBarClass,
}: {
  poll: Poll
  myPlayerId: string | null
  /** Taking votes: active and not past its close time */
  open: boolean
  alwaysShowResults?: boolean
  mutedBarClass: string
}) {
  const [picked, setPicked] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Your taps show at once; the server's copy takes over once every save is in
  useEffect(() => {
    if (!isPending) setPicked(null)
  }, [poll.poll_votes, isPending])

  const saved = poll.poll_votes.filter((v) => v.player_id === myPlayerId).map((v) => v.poll_option_id)
  const mine = picked ?? saved
  const votes = myPlayerId
    ? [...poll.poll_votes.filter((v) => v.player_id !== myPlayerId), ...mine.map((id) => ({ player_id: myPlayerId, poll_option_id: id }))]
    : poll.poll_votes
  const voters = voterCount(votes)
  const sorted = [...poll.poll_options].sort((a, b) => a.sort_order - b.sort_order)
  const multi = !!poll.multiple_choice
  const canVote = open && myPlayerId != null
  const showResults = !open || alwaysShowResults || mine.length > 0

  function save(next: string[]) {
    setPicked(next)
    setError(null)
    startTransition(async () => {
      try {
        await setPollVote(poll.id, next)
      } catch (err) {
        setPicked(null)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function tap(optionId: string) {
    if (!canVote) return
    if (multi) save(mine.includes(optionId) ? mine.filter((id) => id !== optionId) : [...mine, optionId])
    else save(mine.includes(optionId) ? [] : [optionId])
  }

  return (
    <div className="liga-poll-options mt-3">
      {showResults ? (
        <div className="liga-poll-results space-y-1">
          {sorted.map((opt) => {
            const count = votes.filter((v) => v.poll_option_id === opt.id).length
            const pct = voters > 0 ? Math.round((count / voters) * 100) : 0
            const isMine = mine.includes(opt.id)
            const body = (
              <>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className={`flex min-w-0 items-center gap-1.5 ${isMine ? 'font-semibold text-brand-light' : 'text-slate-300'}`}>
                    {isMine && <CheckIcon aria-label="Your vote" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                    <span className="break-words">{opt.label}</span>
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {count} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-[width] ${isMine ? 'bg-brand-light' : mutedBarClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            )
            return canVote ? (
              <button
                key={opt.id}
                type="button"
                onClick={() => tap(opt.id)}
                aria-pressed={isMine}
                className="liga-poll-option -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]"
              >
                {body}
              </button>
            ) : (
              <div key={opt.id} className="py-2">
                {body}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => tap(opt.id)}
              disabled={!canVote}
              className="liga-poll-option liga-button flex w-full items-center gap-3 rounded-lg border border-surface-border px-3 py-2.5 text-left text-sm text-slate-300 transition hover:border-slate-500 disabled:opacity-60"
            >
              <span className={`h-4 w-4 shrink-0 border border-slate-600 ${multi ? 'rounded' : 'rounded-full'}`} aria-hidden="true" />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {canVote && (
        <div className="mt-2 flex min-h-[32px] items-center justify-between gap-3">
          <span className="liga-meta text-[11px] text-slate-500">
            {multi ? 'Tap options to add or remove' : mine.length > 0 ? 'Tap another option to change' : 'Tap an option to vote'}
          </span>
          {mine.length > 0 && (
            <button
              type="button"
              onClick={() => save([])}
              className="shrink-0 text-xs font-medium text-brand-light transition hover:text-white"
            >
              Retract vote
            </button>
          )}
        </div>
      )}

      {error && <p className="liga-alert liga-alert-error mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}
