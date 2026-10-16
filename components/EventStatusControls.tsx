'use client'

import { useState } from 'react'
import { inputCls, labelCls } from './form'
import { STATUS_REASON_MAX, type EventKind, type EventStatus } from '@/lib/event-status'

const NOUN: Record<EventKind, string> = { game: 'match', training: 'training', event: 'event' }

/**
 * Admin edit mode: cancel a game, training or team event, or postpone a game —
 * instead of deleting it. Picking one asks for an optional reason before it's
 * applied; a cancelled/postponed entry offers Reinstate. The confirm step is
 * in the page, not a browser dialog.
 */
export function EventStatusControls({
  kind,
  status,
  disabled,
  onSetStatus,
}: {
  kind: EventKind
  status: EventStatus
  disabled: boolean
  onSetStatus: (status: EventStatus, reason: string | null) => void
}) {
  const [picking, setPicking] = useState<'cancelled' | 'postponed' | null>(null)
  const [reason, setReason] = useState('')
  const noun = NOUN[kind]
  const btn =
    'liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50'
  // Cancelling is red (outlined); Delete below it is solid red, the more severe action
  const dangerBtn =
    'liga-button liga-button-danger flex-1 rounded-lg border border-red-900/60 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-900/20 disabled:opacity-50'

  if (status !== 'scheduled') {
    return (
      <div className="liga-event-status-controls space-y-2">
        <p className="text-xs text-slate-400">
          This {noun} is {status}. It doesn&apos;t count for attendance, appearances or fines.
        </p>
        <button type="button" onClick={() => onSetStatus('scheduled', null)} disabled={disabled} className={`${btn} w-full`}>
          Reinstate {noun}
        </button>
      </div>
    )
  }

  if (picking) {
    const verb = picking === 'cancelled' ? 'Cancel' : 'Postpone'
    return (
      <div className="liga-event-status-controls space-y-2 rounded-xl border border-white/5 p-3">
        <label className={labelCls} htmlFor="event-status-reason">
          Reason (optional, the squad sees it)
        </label>
        <input
          id="event-status-reason"
          type="text"
          value={reason}
          maxLength={STATUS_REASON_MAX}
          onChange={(e) => setReason(e.target.value)}
          className={inputCls}
          placeholder={picking === 'cancelled' ? 'Pitch closed, weather…' : 'New date to be confirmed'}
        />
        <p className="text-[11px] text-slate-500">
          RSVPs are kept but replies close. It won&apos;t count for attendance, appearances or fines.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setPicking(null); setReason('') }} disabled={disabled} className={btn}>
            Back
          </button>
          <button
            type="button"
            onClick={() => onSetStatus(picking, reason.trim() || null)}
            disabled={disabled}
            className={dangerBtn}
          >
            {verb} {noun}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="liga-event-status-controls flex gap-2">
      {kind === 'game' && (
        <button type="button" onClick={() => setPicking('postponed')} disabled={disabled} className={btn}>
          Postpone match
        </button>
      )}
      <button type="button" onClick={() => setPicking('cancelled')} disabled={disabled} className={dangerBtn}>
        Cancel {noun}
      </button>
    </div>
  )
}
