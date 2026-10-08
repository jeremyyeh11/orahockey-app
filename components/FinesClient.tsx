'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Modal from '@/components/Modal'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { FINE_AMOUNT, FINE_KIND_NOUN, fineHref, fineKey, finesByPlayer, isOutstanding, type Fine, type RsvpStatus } from '@/lib/fines'
import { setFinePaid, setFineWaived } from '@/app/admin/fines/actions'
import { preferredName } from '@/components/RosterList'

const STATUS: Record<RsvpStatus, string> = { attending: "I'm in", maybe: 'Maybe', not_attending: 'Out' }

/** What a fine was for, in a line */
function fineLine(f: Fine) {
  if (f.reason === 'late_change') {
    return `Changed ${STATUS[f.from!]} → ${STATUS[f.to!]} · ${fmtDateTime(f.at)} (within 24h before the ${FINE_KIND_NOUN[f.kind]})`
  }
  return f.repliedAt ? `Replied ${fmtDateTime(f.repliedAt)} · due ${fmtDateTime(f.at)}` : `No reply · due ${fmtDateTime(f.at)}`
}

const actionCls =
  'liga-compact-button liga-button-secondary border px-2.5 text-[11px] font-semibold text-slate-300 transition hover:text-white disabled:opacity-40'

/**
 * One month's fines for the whole team (everyone sees everyone's): a status card
 * (outstanding / settled), then each player, most owed first. Players with
 * anything outstanding start expanded; fully settled ones collapse. Paid and
 * waived fines are greyed out. Admins mark fines paid or waive them (with a
 * reason); anyone can copy what's still owed to paste into WhatsApp.
 */
export default function FinesClient({
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
  const nameOf = (id: string) => (players[id] ? preferredName(players[id]) : 'Unknown player')
  const rows = finesByPlayer(fines).sort(
    (a, b) => Number(a.settled) - Number(b.settled) || b.total - a.total || nameOf(a.playerId).localeCompare(nameOf(b.playerId))
  )
  const owing = rows.filter((r) => !r.settled)
  const outstanding = owing.reduce((s, r) => s + r.total, 0)
  const outstandingCount = owing.reduce((s, r) => s + r.count, 0)
  const paidCount = rows.reduce((s, r) => s + r.paid, 0)
  const waivedCount = rows.reduce((s, r) => s + r.waived, 0)

  // Open while they owe anything, collapsed once settled — unless toggled by hand
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [waiving, setWaiving] = useState<Fine | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const isOpen = (r: { playerId: string; settled: boolean }) => toggled[r.playerId] ?? !r.settled

  function copy() {
    const text = [
      `ORA Hockey fines · ${monthTitle} ($${FINE_AMOUNT} each)`,
      ...owing.map((r) => `${nameOf(r.playerId)} — $${r.total} (${r.count})`),
      `Outstanding: $${outstanding}`,
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  /** Run an admin change on one fine; `after` runs once it's saved */
  function change(f: Fine, action: () => Promise<void>, after?: () => void) {
    setPendingKey(fineKey(f))
    setError(null)
    startTransition(async () => {
      try {
        await action()
        after?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setPendingKey(null)
      }
    })
  }
  const ref = (f: Fine) => ({ playerId: f.playerId, kind: f.kind, itemId: f.itemId, reason: f.reason })

  return (
    <div className="liga-page liga-fines p-4">
      <div className="liga-page-header mb-4">
        <h1 className="liga-page-title text-white">Fines</h1>
        <p className="liga-meta mt-1 text-slate-400">
          ${FINE_AMOUNT} for a late or missing reply, or changing your RSVP within 24h before a training, match or event without telling the
          coaching committee.
        </p>
      </div>

      {/* Month */}
      <div className="liga-fines-month mb-3 flex items-center justify-between gap-3">
        <Link href={prevHref} className="liga-button liga-button-secondary rounded-lg border px-3 text-xs font-semibold text-slate-300 hover:text-white">
          ← Prev
        </Link>
        <div className="text-base font-semibold text-white">{monthTitle}</div>
        {nextHref ? (
          <Link href={nextHref} className="liga-button liga-button-secondary rounded-lg border px-3 text-xs font-semibold text-slate-300 hover:text-white">
            Next →
          </Link>
        ) : (
          <span className="liga-button invisible px-3 text-xs" aria-hidden="true">Next →</span>
        )}
      </div>

      {/* Outstanding / settled */}
      {rows.length > 0 && (
        <div
          data-state={outstanding > 0 ? 'outstanding' : 'settled'}
          className={`liga-fines-status card mb-4 flex items-center justify-between gap-3 p-4 ${
            outstanding > 0 ? 'border-red-900/60 bg-red-950/30' : 'border-brand/40 bg-brand/10'
          }`}
        >
          <div className="min-w-0">
            <div className={`liga-section-title ${outstanding > 0 ? 'text-red-300' : 'text-brand-light'}`}>
              {outstanding > 0 ? 'Outstanding' : 'Settled'}
            </div>
            <div className="liga-meta mt-1 text-slate-400">
              {outstanding > 0
                ? `${outstandingCount} unpaid fine${outstandingCount === 1 ? '' : 's'} · ${owing.length} player${owing.length === 1 ? '' : 's'}`
                : 'Every fine paid or waived'}
              {paidCount > 0 && ` · ${paidCount} paid`}
              {waivedCount > 0 && ` · ${waivedCount} waived`}
            </div>
          </div>
          <div className={`shrink-0 font-mono text-2xl font-bold tabular-nums ${outstanding > 0 ? 'text-white' : 'text-brand-light'}`}>
            {outstanding > 0 ? `$${outstanding}` : '✓'}
          </div>
        </div>
      )}

      {outstanding > 0 && (
        <button
          type="button"
          onClick={copy}
          className="liga-button liga-button-secondary mb-4 w-full rounded-lg border text-xs font-semibold text-slate-300 transition hover:text-white"
        >
          {copied ? 'Copied' : 'Copy outstanding for WhatsApp'}
        </button>
      )}

      {error && !waiving && <p className="liga-alert liga-alert-error mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No fines in {monthTitle}.</p>
      ) : (
        <div className="liga-fines-list">
          {rows.map((r) => {
            const open = isOpen(r)
            return (
              <div key={r.playerId} className="liga-fines-player border-b border-surface-border">
                <button
                  type="button"
                  onClick={() => setToggled((prev) => ({ ...prev, [r.playerId]: !open }))}
                  aria-expanded={open}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className={`min-w-0 break-words text-sm font-semibold ${r.settled ? 'text-slate-500' : 'text-white'}`}>
                    {nameOf(r.playerId)}
                    {r.playerId === myPlayerId && <span className="liga-meta ml-2 font-normal text-brand-light">You</span>}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="liga-meta text-slate-400">{r.settled ? 'Settled' : `${r.count} unpaid`}</span>
                    <span className={`font-mono text-sm font-semibold tabular-nums ${r.settled ? 'text-slate-500' : 'text-white'}`}>${r.total}</span>
                    <span aria-hidden="true" className={`text-xs text-slate-500 transition ${open ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </span>
                </button>
                {open && (
                  <ul className="space-y-2 pb-3">
                    {r.fines.map((f) => {
                      const key = fineKey(f)
                      const settled = !isOutstanding(f)
                      return (
                        <li
                          key={key}
                          data-settled={settled || undefined}
                          className={`liga-fine flex items-start justify-between gap-3 rounded-lg px-3 py-2 ${
                            settled ? 'bg-white/[0.02] opacity-50 grayscale' : 'bg-white/[0.04]'
                          }`}
                        >
                          <div className="min-w-0">
                            <Link href={fineHref(basePath, f)} className="break-words text-xs font-semibold text-white hover:underline">
                              {f.reason === 'late_change' ? 'Late change' : 'Late reply'} · {f.title}
                            </Link>
                            <div className="liga-meta mt-0.5 text-slate-400">{fineLine(f)}</div>
                            {f.waived && (
                              <div className="liga-meta mt-0.5 font-semibold text-slate-300">
                                Waived{f.waiveNote ? ` — ${f.waiveNote}` : ''}
                              </div>
                            )}
                            {f.paid && !f.waived && (
                              <div className="liga-meta mt-0.5 font-semibold text-slate-300">Paid{f.paidAt ? ` ${fmtDate(f.paidAt)}` : ''}</div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className={`font-mono text-xs tabular-nums ${settled ? 'text-slate-500 line-through' : 'text-white'}`}>${FINE_AMOUNT}</span>
                            {isAdmin && (
                              <div className="flex gap-1.5">
                                {settled ? (
                                  <button
                                    type="button"
                                    disabled={pendingKey === key}
                                    onClick={() => change(f, () => (f.waived ? setFineWaived(ref(f), false) : setFinePaid(ref(f), false)))}
                                    className={actionCls}
                                  >
                                    {f.waived ? 'Undo waive' : 'Undo paid'}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={pendingKey === key}
                                      onClick={() => change(f, () => setFinePaid(ref(f), true))}
                                      className={actionCls}
                                    >
                                      Paid
                                    </button>
                                    <button type="button" disabled={pendingKey === key} onClick={() => setWaiving(f)} className={actionCls}>
                                      Waive
                                    </button>
                                  </>
                                )}
                              </div>
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
        A late reply counts in the month its deadline passed; a late change in the month it was made. Only players with an app account
        can be fined.
      </p>

      {waiving && (
        <WaiveModal
          fine={waiving}
          name={nameOf(waiving.playerId)}
          pending={pendingKey === fineKey(waiving)}
          error={error}
          onCancel={() => {
            setWaiving(null)
            setError(null)
          }}
          onWaive={(note) => change(waiving, () => setFineWaived(ref(waiving), true, note), () => setWaiving(null))}
        />
      )}
    </div>
  )
}

/** Asks why a fine is being waived — the reason shows on the fine for everyone */
function WaiveModal({
  fine,
  name,
  pending,
  error,
  onCancel,
  onWaive,
}: {
  fine: Fine
  name: string
  pending: boolean
  error: string | null
  onCancel: () => void
  onWaive: (note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <Modal onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (note.trim()) onWaive(note.trim())
        }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-lg font-bold text-white">Waive fine</h2>
          <p className="liga-meta mt-1 text-slate-400">
            {name} · {fine.reason === 'late_change' ? 'Late change' : 'Late reply'} · {fine.title}
          </p>
        </div>
        <div>
          <label htmlFor="waive-reason" className="mb-1 block text-xs font-medium text-slate-400">
            Reason *
          </label>
          <textarea
            id="waive-reason"
            required
            autoFocus
            rows={3}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. PM'd Ish before changing"
            className="liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="mt-1 text-[11px] text-slate-500">Shown on the fine for everyone.</p>
        </div>
        {error && <p className="liga-alert liga-alert-error rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border text-sm font-medium text-slate-300 transition hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !note.trim()}
            className="liga-button liga-button-primary bg-accent flex-1 rounded-lg text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
          >
            {pending ? 'Waiving…' : 'Waive fine'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
