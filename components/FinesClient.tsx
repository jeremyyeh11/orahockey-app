'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Modal from '@/components/Modal'
import { FormButtons, FormError, hintCls, inputCls, labelCls } from '@/components/form'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { FINE_AMOUNT, FINE_KIND_NOUN, RSVP_LABEL, centsFromDigits, fineHref, fineKey, finesByPlayer, fmtMoney, isOutstanding, type Fine } from '@/lib/fines'
import { addFine, setFinePaid, setFineWaived } from '@/app/dashboard/fines/actions'
import { preferredName } from '@/lib/names'
import { unwrap } from '@/lib/action-result'
import { FineRules } from '@/components/FineRules'

/** What a fine was for, in a line */
function fineLine(f: Fine) {
  if (f.kind === 'manual') return `Added ${fmtDateTime(f.at)}`
  if (f.reason === 'late_change') {
    return `Changed ${RSVP_LABEL[f.from!]} → ${RSVP_LABEL[f.to!]} · ${fmtDateTime(f.at)} (within 24h before the ${FINE_KIND_NOUN[f.kind]})`
  }
  if (f.undecided) return `Still on ${RSVP_LABEL.maybe} · due ${fmtDateTime(f.at)}`
  return f.repliedAt ? `Replied ${fmtDateTime(f.repliedAt)} · due ${fmtDateTime(f.at)}` : `No reply · due ${fmtDateTime(f.at)}`
}

/** A fine's heading: 'Late reply · Training · Tue 3 Nov', or the finemaster's own reason */
const fineHeading = (f: Fine) => (f.reason === 'manual' ? f.title : `${f.reason === 'late_change' ? 'Late change' : 'Late reply'} · ${f.title}`)

const actionCls =
  'liga-compact-button liga-button-secondary border px-2.5 text-[11px] font-semibold text-slate-300 transition hover:text-white disabled:opacity-40'

/**
 * One month's fines for the whole team (everyone sees everyone's): a status card
 * (outstanding / settled), then each player, most owed first. Players with
 * anything outstanding start expanded; fully settled ones collapse. Paid and
 * waived fines are greyed out. Finemasters and the superadmin add fines by hand,
 * mark fines paid or waive them (with a reason); anyone can copy what's still owed to paste
 * into WhatsApp.
 */
export default function FinesClient({
  monthTitle,
  prevHref,
  nextHref,
  fines,
  players,
  myPlayerId,
  canManage,
  basePath,
}: {
  month: string
  monthTitle: string
  prevHref: string
  nextHref: string | null
  fines: Fine[]
  players: Record<string, { full_name: string; preferred_name: string | null; is_active: boolean }>
  myPlayerId: string | null
  /** Finemaster or superadmin: Add fine, Paid and Waive buttons */
  canManage: boolean
  basePath: '/dashboard' | '/admin'
}) {
  const nameOf = (id: string) => (players[id] ? preferredName(players[id]) : 'Unknown player')
  const rows = finesByPlayer(fines).sort(
    (a, b) => Number(a.settled) - Number(b.settled) || b.total - a.total || nameOf(a.playerId).localeCompare(nameOf(b.playerId))
  )
  const owing = rows.filter((r) => !r.settled)
  const outstanding = Math.round(owing.reduce((s, r) => s + r.total, 0) * 100) / 100
  const outstandingCount = owing.reduce((s, r) => s + r.count, 0)
  const paidCount = rows.reduce((s, r) => s + r.paid, 0)
  const waivedCount = rows.reduce((s, r) => s + r.waived, 0)

  // Open while they owe anything, collapsed once settled — unless toggled by hand
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [waiving, setWaiving] = useState<Fine | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const isOpen = (r: { playerId: string; settled: boolean }) => toggled[r.playerId] ?? !r.settled

  function copy() {
    const text = [
      `ORA Hockey fines · ${monthTitle}${fines.some((f) => f.kind === 'manual') ? '' : ` ($${FINE_AMOUNT} each)`}`,
      ...owing.map((r) => `${nameOf(r.playerId)} — ${fmtMoney(r.total)} (${r.count})`),
      `Outstanding: ${fmtMoney(outstanding)}`,
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
        <FineRules />
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

      {canManage && (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setAdding(true)
          }}
          className="liga-button liga-button-secondary mb-4 w-full rounded-lg border text-xs font-semibold text-slate-300 transition hover:text-white"
        >
          + Add fine
        </button>
      )}

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
            {outstanding > 0 ? fmtMoney(outstanding) : '✓'}
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

      {error && !waiving && !adding && <p className="liga-alert liga-alert-error mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

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
                    <span className={`font-mono text-sm font-semibold tabular-nums ${r.settled ? 'text-slate-500' : 'text-white'}`}>{fmtMoney(r.total)}</span>
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
                      const href = fineHref(basePath, f)
                      return (
                        <li
                          key={key}
                          data-settled={settled || undefined}
                          className={`liga-fine flex items-start justify-between gap-3 rounded-lg px-3 py-2 ${
                            settled ? 'bg-white/[0.02] opacity-50 grayscale' : 'bg-white/[0.04]'
                          }`}
                        >
                          <div className="min-w-0">
                            {href ? (
                              <Link href={href} className="break-words text-xs font-semibold text-white hover:underline">
                                {fineHeading(f)}
                              </Link>
                            ) : (
                              <span className="break-words text-xs font-semibold text-white">{fineHeading(f)}</span>
                            )}
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
                            <span className={`font-mono text-xs tabular-nums ${settled ? 'text-slate-500 line-through' : 'text-white'}`}>{fmtMoney(f.amount)}</span>
                            {canManage && (
                              <div className="flex gap-1.5">
                                {settled ? (
                                  <button
                                    type="button"
                                    disabled={pendingKey === key}
                                    onClick={() => change(f, () => (f.waived ? unwrap(setFineWaived(ref(f), false)) : unwrap(setFinePaid(ref(f), false))))}
                                    className={actionCls}
                                  >
                                    {f.waived ? 'Undo waive' : 'Undo paid'}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={pendingKey === key}
                                      onClick={() => change(f, () => unwrap(setFinePaid(ref(f), true)))}
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
          onWaive={(note) => change(waiving, () => unwrap(setFineWaived(ref(waiving), true, note)), () => setWaiving(null))}
        />
      )}

      {adding && (
        <AddFineModal
          players={Object.entries(players)
            .filter(([, p]) => p.is_active)
            .map(([id]) => ({ id, name: nameOf(id) }))
            .sort((a, b) => a.name.localeCompare(b.name))}
          onClose={() => setAdding(false)}
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
            {name} · {fineHeading(fine)}
          </p>
        </div>
        <div>
          <label htmlFor="waive-reason" className={labelCls}>
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
            className={inputCls}
          />
          <p className={hintCls}>Shown on the fine for everyone.</p>
        </div>
        <FormError error={error} />
        <FormButtons isPending={pending} disabled={!note.trim()} onCancel={onCancel} label="Waive fine" pendingLabel="Waiving…" />
      </form>
    </Modal>
  )
}

/**
 * Adds a fine by hand: player, reason and amount. The amount is keyed as digits
 * only and fills in from the cents: 2 → $0.02, 22 → $0.22, 220 → $2.20.
 */
function AddFineModal({ players, onClose }: { players: { id: string; name: string }[]; onClose: () => void }) {
  const [playerId, setPlayerId] = useState('')
  const [reason, setReason] = useState('')
  const [cents, setCents] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ready = !!playerId && !!reason.trim() && cents > 0

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready) return
          setError(null)
          startTransition(async () => {
            try {
              await unwrap(addFine({ playerId, reason: reason.trim(), amountCents: cents }))
              onClose()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Something went wrong')
            }
          })
        }}
        className="space-y-4"
      >
        <h2 className="text-lg font-bold text-white">Add fine</h2>
        <div>
          <label htmlFor="fine-player" className={labelCls}>
            Player *
          </label>
          <select id="fine-player" required value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={inputCls}>
            <option value="">Pick a player</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fine-reason" className={labelCls}>
            Reason *
          </label>
          <input
            id="fine-reason"
            required
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Forgot the team kit"
            className={inputCls}
          />
          <p className={hintCls}>Shown on the fine for everyone.</p>
        </div>
        <div>
          <label htmlFor="fine-amount" className={labelCls}>
            Amount *
          </label>
          <input
            id="fine-amount"
            required
            inputMode="numeric"
            autoComplete="off"
            value={`$${(cents / 100).toFixed(2)}`}
            onChange={(e) => setCents(centsFromDigits(e.target.value))}
            className={`${inputCls} font-mono tabular-nums`}
          />
          <p className={hintCls}>Type the digits only: 220 is $2.20.</p>
        </div>
        <FormError error={error} />
        <FormButtons isPending={pending} disabled={!ready} onCancel={onClose} label="Add fine" pendingLabel="Adding…" />
      </form>
    </Modal>
  )
}
