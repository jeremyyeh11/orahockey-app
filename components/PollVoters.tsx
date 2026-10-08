'use client'

import { useState, type ReactNode } from 'react'
import { fmtDateTime } from '@/lib/format'
import type { FineReason } from '@/lib/fines'
import { preferredName } from '@/components/RosterList'

type Person = { id: string; full_name: string; preferred_name: string | null }

/**
 * Who's voted on a poll and who hasn't — not what anyone picked, so votes stay
 * anonymous. Voters are listed in the order they voted, with when; anyone fined
 * for the poll (unwaived — a late or missing vote) is in red. Collapsed behind a
 * right-aligned summary ("12 voted · 18 haven't · 2 late") — tap it to open.
 * `actions` (admin Close poll / Delete) sit on the left of that row.
 */
export function PollVoters({
  votes,
  roster,
  fined,
  actions,
}: {
  votes: { player_id: string; voted_at?: string }[]
  /** The squad expected to vote (active players) — everyone not in `votes` hasn't */
  roster: Person[]
  /** This poll's unwaived fines by player */
  fined?: Record<string, FineReason[]>
  /** Buttons on the left of the summary row */
  actions?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const byId = new Map(roster.map((p) => [p.id, p]))
  const nameOf = (id: string) => (byId.get(id) ? preferredName(byId.get(id)!) : 'Former player')
  // A multiple-answer vote is several rows: one per voter, at their earliest
  const firstVote = new Map<string, { player_id: string; voted_at?: string }>()
  for (const v of votes) {
    const prev = firstVote.get(v.player_id)
    if (!prev || (v.voted_at ?? '') < (prev.voted_at ?? '')) firstVote.set(v.player_id, v)
  }
  const voted = Array.from(firstVote.values()).sort((a, b) => (a.voted_at ?? '').localeCompare(b.voted_at ?? ''))
  const votedIds = new Set(Array.from(firstVote.keys()))
  const notVoted = roster.filter((p) => !votedIds.has(p.id)).sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id)))
  const late = Object.keys(fined ?? {}).length

  const row = (id: string, at?: string) => {
    const isFined = !!fined?.[id]?.length
    return (
      <div
        key={id}
        data-fined={isFined ? '' : undefined}
        className={`liga-breakdown-row -mx-1.5 flex items-baseline justify-between gap-3 rounded px-1.5 py-px text-[11px] ${
          isFined ? 'bg-red-900/40 text-red-200' : 'text-slate-300'
        }`}
      >
        <span className="min-w-0 break-words">
          {nameOf(id)}
          {isFined && (
            <span className="liga-fine-mark ml-1.5 rounded bg-red-900/50 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-red-300">Late</span>
          )}
        </span>
        {at && <span className={`liga-meta shrink-0 ${isFined ? 'text-red-300' : 'text-slate-500'}`}>{fmtDateTime(at)}</span>}
      </div>
    )
  }

  return (
    <div className="liga-poll-voters liga-divider mt-4 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between gap-3">
        {actions && <div className="liga-actions flex shrink-0 gap-2">{actions}</div>}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-[32px] flex-1 items-center justify-end gap-3 text-right"
        >
          <span className="flex items-center gap-2">
            <span className="liga-meta text-slate-400">
              {voted.length} voted · {notVoted.length} haven&apos;t
              {late > 0 && <span className="text-red-400"> · {late} late</span>}
            </span>
            <span aria-hidden="true" className={`text-xs text-slate-500 transition ${open ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </span>
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {voted.length > 0 && (
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[11px] font-medium text-slate-500">
                <span>Voted ({voted.length})</span>
                <span className="liga-section-title shrink-0 normal-case tracking-normal">Voted on</span>
              </div>
              <div className="space-y-0.5">{voted.map((v) => row(v.player_id, v.voted_at))}</div>
            </div>
          )}
          {notVoted.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500">Hasn&apos;t voted ({notVoted.length})</div>
              <div className="space-y-0.5">{notVoted.map((p) => row(p.id))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
