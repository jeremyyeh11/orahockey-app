'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { preferredName } from './RosterList'
import { castPotmVote } from '@/app/dashboard/polls/potmActions'
import { fmtDateTime } from '@/lib/format'
import type { PotmPoll } from '@/lib/potm'

/**
 * Player-of-the-Match voting for the Polls tab (backlog #5). Rank 1st/2nd/3rd from the
 * match team list, confirm-to-lock, results stay secret until the poll closes. The
 * not-yet-voted tags update live via Supabase Realtime on the ballot receipts, and an
 * auto-close (last voter in) flips the card to results without a manual refresh.
 */
export default function PotmPolls({
  polls: initial,
  myPlayerId,
}: {
  polls: PotmPoll[]
  myPlayerId: string | null
}) {
  const [polls, setPolls] = useState(initial)
  const router = useRouter()

  // Reconcile with fresh server data after any revalidation / refresh.
  useEffect(() => setPolls(initial), [initial])

  // Live updates: a new ballot receipt removes that player's tag for everyone; a poll
  // flipping to closed pulls the freshly-written placings via a refresh. The ballot /
  // poll RLS is authenticated-only, so the Realtime socket must carry the user's token
  // (the ssr browser client connects as anon otherwise and receives nothing).
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const onBallotInsert = (payload: { new: unknown }) => {
      const row = payload.new as { poll_id: string; voter_id: string }
      setPolls((prev) =>
        prev.map((p) =>
          p.id === row.poll_id && !p.voterIds.includes(row.voter_id)
            ? { ...p, voterIds: [...p.voterIds, row.voter_id] }
            : p
        )
      )
    }
    const onPollUpdate = (payload: { new: unknown }) => {
      const row = payload.new as { id: string; status: 'open' | 'closed' }
      setPolls((prev) => prev.map((p) => (p.id === row.id ? { ...p, status: row.status } : p)))
      if (row.status === 'closed') router.refresh()
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const token = data.session?.access_token
      if (token) supabase.realtime.setAuth(token)
      channel = supabase
        .channel('potm-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'potm_ballots' }, onBallotInsert)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'potm_polls' }, onPollUpdate)
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [router])

  if (polls.length === 0) return null

  const open = polls.filter((p) => p.status === 'open')
  const closed = polls.filter((p) => p.status === 'closed')

  function handleVoted(pollId: string) {
    if (myPlayerId) {
      setPolls((prev) =>
        prev.map((p) =>
          p.id === pollId && !p.voterIds.includes(myPlayerId)
            ? { ...p, voterIds: [...p.voterIds, myPlayerId] }
            : p
        )
      )
    }
    router.refresh()
  }

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-white">Player of the Match</h2>
      <div className="space-y-3">
        {open.map((p) => (
          <PotmCard key={p.id} poll={p} myPlayerId={myPlayerId} onVoted={handleVoted} />
        ))}
        {closed.map((p) => (
          <PotmCard key={p.id} poll={p} myPlayerId={myPlayerId} onVoted={handleVoted} />
        ))}
      </div>
    </div>
  )
}

const PLACE_META: Record<number, { label: string; cls: string }> = {
  1: { label: '1st', cls: 'text-yellow-300' },
  2: { label: '2nd', cls: 'text-slate-300' },
  3: { label: '3rd', cls: 'text-amber-600' },
}

function PotmCard({
  poll,
  myPlayerId,
  onVoted,
}: {
  poll: PotmPoll
  myPlayerId: string | null
  onVoted: (pollId: string) => void
}) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [third, setThird] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isClosed = poll.status === 'closed'
  const eligible = myPlayerId != null && poll.candidates.some((c) => c.id === myPlayerId)
  const hasVoted = myPlayerId != null && poll.voterIds.includes(myPlayerId)

  const nameOf = (id: string) => {
    const c = poll.candidates.find((x) => x.id === id)
    return c ? preferredName(c) : '—'
  }

  const votedCount = poll.voterIds.length
  const totalEligible = poll.candidates.length
  const notVoted = poll.candidates.filter((c) => !poll.voterIds.includes(c.id))

  const allPicked = !!first && !!second && !!third
  const canVote = eligible && !hasVoted && totalEligible >= 3

  function handleConfirm() {
    if (!allPicked) return
    setError(null)
    setBusy(true)
    castPotmVote(poll.id, first, second, third)
      .then(() => onVoted(poll.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setBusy(false))
  }

  // Results grouped by place (shared places allowed).
  const byPlace = new Map<number, string[]>()
  for (const r of poll.result) {
    const arr = byPlace.get(r.place) ?? []
    arr.push(nameOf(r.player_id))
    byPlace.set(r.place, arr)
  }

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">POTM · vs {poll.opponent}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {poll.game_date && fmtDateTime(poll.game_date)}
            {' · '}
            {isClosed ? 'closed' : `${votedCount}/${totalEligible} voted`}
          </div>
        </div>
        {!isClosed && (
          <span className="shrink-0 rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-300">
            Open
          </span>
        )}
      </div>

      {/* Closed → result */}
      {isClosed && (
        <div className="mt-3 space-y-1.5">
          {poll.result.length === 0 && (
            <p className="text-xs text-slate-500">No votes were cast.</p>
          )}
          {[1, 2, 3].map((place) =>
            byPlace.has(place) ? (
              <div key={place} className="flex items-center gap-2 text-sm">
                <span className={`w-8 shrink-0 text-xs font-bold ${PLACE_META[place].cls}`}>
                  {PLACE_META[place].label}
                </span>
                <span className="text-white">{byPlace.get(place)!.join(', ')}</span>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Open + eligible + not yet voted → rank selectors + confirm-to-lock */}
      {!isClosed && canVote && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 text-xs font-medium text-slate-400">Your vote</div>
          <div className="space-y-2">
            <RankSelect
              label="1st"
              value={first}
              onChange={setFirst}
              candidates={poll.candidates}
              exclude={[second, third]}
              disabled={busy}
            />
            <RankSelect
              label="2nd"
              value={second}
              onChange={setSecond}
              candidates={poll.candidates}
              exclude={[first, third]}
              disabled={busy}
            />
            <RankSelect
              label="3rd"
              value={third}
              onChange={setThird}
              candidates={poll.candidates}
              exclude={[first, second]}
              disabled={busy}
            />
          </div>

          {allPicked && (
            <div className="mt-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-slate-200">
              You’re voting — <span className="text-yellow-300">1st</span> {nameOf(first)},{' '}
              <span className="text-slate-300">2nd</span> {nameOf(second)},{' '}
              <span className="text-amber-600">3rd</span> {nameOf(third)}. This can’t be changed
              once confirmed.
            </div>
          )}

          {error && (
            <p className="mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!allPicked || busy}
            className="bg-accent mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? 'Confirming…' : 'Confirm vote'}
          </button>
        </div>
      )}

      {/* Open + already voted → locked warning */}
      {!isClosed && hasVoted && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
          🔒 Your vote is locked in — no changes allowed. Results show once the poll closes.
        </div>
      )}

      {/* Open + not on the team list → view-only note */}
      {!isClosed && !eligible && (
        <p className="mt-4 text-xs text-slate-500">
          Voting is limited to players on this match team list.
        </p>
      )}

      {/* Open + eligible but too few candidates to rank three */}
      {!isClosed && eligible && !hasVoted && totalEligible < 3 && (
        <p className="mt-4 text-xs text-slate-500">Not enough listed players to rank a top three.</p>
      )}

      {/* Not-yet-voted tags (live). Current user's tag highlighted green if still pending. */}
      {!isClosed && notVoted.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 text-xs font-medium text-slate-400">Yet to vote</div>
          <div className="flex flex-wrap gap-1.5">
            {notVoted.map((c) => {
              const isMe = c.id === myPlayerId
              return (
                <span
                  key={c.id}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    isMe
                      ? 'border-green-500/60 bg-green-900/40 text-green-300'
                      : 'border-surface-border text-slate-400'
                  }`}
                >
                  {preferredName(c)}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RankSelect({
  label,
  value,
  onChange,
  candidates,
  exclude,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  candidates: PotmPoll['candidates']
  exclude: string[]
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs font-semibold text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-2 py-2 text-xs text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-40"
      >
        <option value="">— select player —</option>
        {candidates
          .filter((c) => c.id === value || !exclude.includes(c.id))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {preferredName(c)}
              {c.jersey_number != null ? ` · #${c.jersey_number}` : ''}
            </option>
          ))}
      </select>
    </div>
  )
}
