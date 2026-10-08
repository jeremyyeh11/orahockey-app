'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { fmtDateTime } from '@/lib/format'
import { FINE_AMOUNT, FINE_KIND_NOUN, fineHref, fineKey, finesByPlayer, type Fine, type RsvpStatus } from '@/lib/fines'
import { setFineWaived } from '@/app/admin/fines/actions'
import { preferredName } from '@/components/RosterList'

const STATUS: Record<RsvpStatus, string> = { attending: "I'm in", maybe: 'Maybe', not_attending: 'Out' }

/** What a fine was for, in a line */
function fineLine(f: Fine) {
  if (f.reason === 'late_change') return `Changed ${STATUS[f.from!]} → ${STATUS[f.to!]} · ${fmtDateTime(f.at)} (within 24h before the ${FINE_KIND_NOUN[f.kind]})`
  return f.repliedAt ? `Replied ${fmtDateTime(f.repliedAt)} · due ${fmtDateTime(f.at)}` : `No reply · due ${fmtDateTime(f.at)}`
}

/**
 * One month's fines for the whole team (everyone sees everyone's): per player,
 * most owed first, tap to see what each fine was for. Admins waive or restore
 * single fines; anyone can copy the list to paste into WhatsApp.
 */
export default function FinesClient({
  month,
  monthTitle,
  prevHref,
  nextHref,
  fines,
  players,
  myPlayerId,
  isAdmin,
  basePath,
}: {
  month: string
  monthTitle: string
  prevHref: string
  nextHref: string | null
  fines: Fine[]
  players: Record<string, { full_name: string; preferred_name: string | null }>
  myPlayerId: string | null
  isAdmin: boolean
  basePath: '/dashboard' | '/admin'
}) {
  const [open, setOpen] = useState<string | null>(myPlayerId)
  const [copied, setCopied] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const nameOf = (id: string) => (players[id] ? preferredName(players[id]) : 'Unknown player')
  const rows = finesByPlayer(fines).sort((a, b) => b.total - a.total || nameOf(a.playerId).localeCompare(nameOf(b.playerId)))
  const owed = rows.filter((r) => r.total > 0)
  const total = owed.reduce((s, r) => s + r.total, 0)
  const count = owed.reduce((s, r) => s + r.count, 0)

  function copy() {
    const text = [
      `ORA Hockey fines · ${monthTitle} ($${FINE_AMOUNT} each)`,
      ...owed.map((r) => `${nameOf(r.playerId)} — $${r.total} (${r.count})`),
      `Total: $${total}`,
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function toggleWaive(f: Fine) {
    const key = fineKey(f)
    setPendingKey(key)
    setError(null)
    startTransition(async () => {
      try {
        await setFineWaived({ playerId: f.playerId, kind: f.kind, itemId: f.itemId, reason: f.reason }, !f.waived)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setPendingKey(null)
      }
    })
  }

  return (
    <div className="liga-page liga-fines p-4">
      <div className="liga-page-header mb-4">
        <h1 className="liga-page-title text-white">Fines</h1>
        <p className="liga-meta mt-1 text-slate-400">
          ${FINE_AMOUNT} for a late or missing reply, or changing your RSVP within 24h before a training, match or event without telling the coaching committee.
        </p>
      </div>

      {/* Month */}
      <div className="liga-fines-month mb-4 flex items-center justify-between gap-3">
        <Link href={prevHref} className="liga-button liga-button-secondary rounded-lg border px-3 text-xs font-semibold text-slate-300 hover:text-white">
          ← Prev
        </Link>
        <div className="text-center">
          <div className="text-base font-semibold text-white">{monthTitle}</div>
          <div className="liga-meta text-slate-400">
            {count > 0 ? `$${total} · ${count} fine${count === 1 ? '' : 's'} · ${owed.length} player${owed.length === 1 ? '' : 's'}` : 'No fines'}
          </div>
        </div>
        {nextHref ? (
          <Link href={nextHref} className="liga-button liga-button-secondary rounded-lg border px-3 text-xs font-semibold text-slate-300 hover:text-white">
            Next →
          </Link>
        ) : (
          <span className="liga-button invisible px-3 text-xs" aria-hidden="true">Next →</span>
        )}
      </div>

      {count > 0 && (
        <button
          type="button"
          onClick={copy}
          className="liga-button liga-button-secondary mb-4 w-full rounded-lg border text-xs font-semibold text-slate-300 transition hover:text-white"
        >
          {copied ? 'Copied' : 'Copy list for WhatsApp'}
        </button>
      )}

      {error && <p className="liga-alert liga-alert-error mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No fines in {monthTitle}.</p>
      ) : (
        <div className="liga-fines-list">
          {rows.map((r) => {
            const expanded = open === r.playerId
            return (
              <div key={r.playerId} className="liga-fines-player border-b border-surface-border">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : r.playerId)}
                  aria-expanded={expanded}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0 break-words text-sm font-semibold text-white">
                    {nameOf(r.playerId)}
                    {r.playerId === myPlayerId && <span className="liga-meta ml-2 font-normal text-brand-light">You</span>}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="liga-meta text-slate-400">
                      {r.count > 0 ? `${r.count} fine${r.count === 1 ? '' : 's'}` : `${r.fines.length} waived`}
                    </span>
                    <span className={`font-mono text-sm font-semibold tabular-nums ${r.total > 0 ? 'text-white' : 'text-slate-500'}`}>${r.total}</span>
                  </span>
                </button>
                {expanded && (
                  <ul className="space-y-2 pb-3">
                    {r.fines.map((f) => {
                      const key = fineKey(f)
                      return (
                        <li key={key} className="liga-fine flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                          <div className="min-w-0">
                            <Link href={fineHref(basePath, f)} className="break-words text-xs font-semibold text-white hover:underline">
                              {f.reason === 'late_change' ? 'Late change' : 'Late reply'} · {f.title}
                            </Link>
                            <div className="liga-meta mt-0.5 text-slate-400">{fineLine(f)}</div>
                            {f.waived && <div className="liga-meta mt-0.5 font-semibold uppercase text-brand-light">Waived</div>}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={`font-mono text-xs tabular-nums ${f.waived ? 'text-slate-500 line-through' : 'text-white'}`}>${FINE_AMOUNT}</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => toggleWaive(f)}
                                disabled={pendingKey === key}
                                className="liga-compact-button liga-button-secondary border px-2 text-[11px] font-semibold text-slate-300 transition hover:text-white disabled:opacity-40"
                              >
                                {f.waived ? 'Undo' : 'Waive'}
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="liga-meta mt-6 text-slate-500">
        A late reply counts in the month its deadline passed; a late change in the month it was made. Only players with an app
        account can be fined.
      </p>
    </div>
  )
}
