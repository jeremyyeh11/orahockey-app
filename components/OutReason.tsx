'use client'

import { useState } from 'react'
import { setOutReason } from '@/app/dashboard/schedule/actions'
import { OUT_REASON_MAX } from '@/lib/fines'
import { unwrap } from '@/lib/action-result'

/**
 * Optional "why I'm out", under the I'm in / Update later / Out buttons while the
 * answer is Out. Saves when you leave the box or press Enter; everyone sees it in
 * the event's attendance list. `disabled` while the Out itself is still saving.
 */
export function OutReason({
  sessionId,
  kind,
  initial,
  disabled = false,
  onAccent = false,
  className = '',
}: {
  sessionId: string
  kind: 'game' | 'training' | 'event'
  initial: string | null | undefined
  disabled?: boolean
  onAccent?: boolean
  className?: string
}) {
  const [value, setValue] = useState(initial ?? '')
  const [saved, setSaved] = useState(initial ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save() {
    const next = value.trim()
    if (next === saved) return
    setState('saving')
    try {
      await unwrap(setOutReason(sessionId, kind, next))
      setSaved(next)
      setState('saved')
    } catch (err) {
      console.error(err)
      setState('error')
    }
  }

  const tone = onAccent
    ? 'border-white/25 bg-black/20 text-white placeholder:text-white/60'
    : 'border-surface-border bg-surface text-slate-200 placeholder:text-slate-500'
  const note = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? "Couldn't save" : null

  return (
    <div className={`liga-out-reason lg:max-w-sm ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setState('idle') }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        disabled={disabled}
        maxLength={OUT_REASON_MAX}
        placeholder="Reason (optional)"
        aria-label="Reason for being out (optional)"
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-slate-400 disabled:opacity-60 ${tone}`}
      />
      {note && (
        <div className={`liga-meta mt-1 ${state === 'error' ? 'text-red-400' : onAccent ? 'text-white/70' : 'text-slate-500'}`}>{note}</div>
      )}
    </div>
  )
}
