'use client'

import { useEffect, useRef, useState } from 'react'
import { fromDatetimeLocal, toDatetimeLocal } from '@/lib/format'
import { FINE_AMOUNT, defaultFinesEnabled, defaultRespondBy, type FineKind } from '@/lib/fines'

const inputCls =
  'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand h-[42px] [color-scheme:dark]'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

const RULE: Record<FineKind, string> = {
  game: 'Club rule: Thu 23:59 before a weekend game, 72h before a weekday one.',
  training: 'Club rule: Thu 23:59 before weekend training, Sun 23:59 before weekday training.',
  event: '72 hours after posting, no later than the start.',
  poll: '72 hours after posting, no later than when the poll closes.',
}

/**
 * "Respond by" + "Fines" for the add/edit forms of games, trainings, team events
 * and polls. The deadline follows the club rule (lib/fines.ts) as the start (or
 * poll close) changes, until it's set by hand. Fines default on — off for team
 * events and for anything already past its deadline. Read back with readFinesFields().
 */
export function FinesFields({
  kind,
  startName,
  closesName,
  saved,
  postedAt,
}: {
  kind: FineKind
  /** The form's start input (datetime-local) — games, trainings, events */
  startName?: string
  /** Polls: the form's closes-at input */
  closesName?: string
  /** Editing: the stored values. Omitted for a new entry. */
  saved?: { respondBy: string | null; finesEnabled: boolean }
  /** When the entry was posted (editing a team event); new entries: now */
  postedAt?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [respondBy, setRespondBy] = useState<string | null>(saved ? saved.respondBy : null)
  const [finesOn, setFinesOn] = useState(saved ? saved.finesEnabled : kind !== 'event')
  // Follow the rule: always for a new entry; when editing, only while the stored
  // deadline is still what the rule gives (so moving the date moves it too).
  // Refs mirror the flags for the form listener below.
  const [auto, setAutoState] = useState(!saved)
  const autoRef = useRef(!saved)
  const setAuto = (v: boolean) => {
    autoRef.current = v
    setAutoState(v)
  }
  const finesTouched = useRef(!!saved)

  useEffect(() => {
    const form = ref.current?.closest('form')
    if (!form) return
    const valueOf = (name?: string) => {
      const el = name ? (form.elements.namedItem(name) as HTMLInputElement | null) : null
      return el?.value ? fromDatetimeLocal(el.value) : null
    }
    const rule = () =>
      defaultRespondBy(kind, {
        start: valueOf(startName),
        closesAt: valueOf(closesName),
        postedAt: postedAt ? new Date(postedAt) : new Date(),
      })

    if (saved) {
      const initial = rule()
      setAuto(!!saved.respondBy && !!initial && sameMinute(saved.respondBy, initial))
    } else {
      const due = rule()
      setRespondBy(due)
      setFinesOn(defaultFinesEnabled(kind, due, new Date()))
    }

    function onChange(e: Event) {
      const name = (e.target as HTMLInputElement | null)?.name
      if (!autoRef.current || !name || (name !== startName && name !== closesName)) return
      const due = rule()
      setRespondBy(due)
      if (!finesTouched.current) setFinesOn(defaultFinesEnabled(kind, due, new Date()))
    }
    form.addEventListener('input', onChange)
    form.addEventListener('change', onChange)
    return () => {
      form.removeEventListener('input', onChange)
      form.removeEventListener('change', onChange)
    }
    // Wire up once per form; the inputs are read live from the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyRule() {
    const form = ref.current?.closest('form')
    const el = startName ? (form?.elements.namedItem(startName) as HTMLInputElement | null) : null
    const closes = closesName ? (form?.elements.namedItem(closesName) as HTMLInputElement | null) : null
    setRespondBy(
      defaultRespondBy(kind, {
        start: el?.value ? fromDatetimeLocal(el.value) : null,
        closesAt: closes?.value ? fromDatetimeLocal(closes.value) : null,
        postedAt: postedAt ? new Date(postedAt) : new Date(),
      })
    )
    setAuto(true)
  }

  const passed = !!respondBy && new Date(respondBy).getTime() <= Date.now()

  return (
    <div ref={ref} className="liga-fines-fields">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <label className={labelCls} htmlFor={`respond-by-${kind}`}>Respond by</label>
          <input
            id={`respond-by-${kind}`}
            type="datetime-local"
            value={respondBy ? toDatetimeLocal(respondBy) : ''}
            onChange={(e) => {
              setAuto(false)
              // A deadline of 23:59 runs to the end of that minute
              setRespondBy(e.target.value ? new Date(new Date(fromDatetimeLocal(e.target.value)).getTime() + 59_000).toISOString() : null)
            }}
            className={inputCls}
          />
        </div>
        <label className="flex h-[42px] shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-slate-300">
          <input
            type="checkbox"
            name="fines_enabled"
            checked={finesOn}
            onChange={(e) => {
              finesTouched.current = true
              setFinesOn(e.target.checked)
            }}
            className="h-4 w-4 accent-brand"
          />
          Fines (${FINE_AMOUNT})
        </label>
      </div>
      <input type="hidden" name="respond_by" value={respondBy ?? ''} />
      <p className="mt-1 text-[11px] text-slate-500">
        {auto ? (
          RULE[kind]
        ) : (
          <>
            {respondBy ? 'Set by hand' : 'No deadline'} ·{' '}
            <button type="button" onClick={applyRule} className="text-brand-light underline-offset-2 hover:underline">
              Use club rule
            </button>
          </>
        )}
      </p>
      {finesOn && passed && (
        <p className="mt-1 text-[11px] text-amber-400">This deadline has passed — anyone who hasn&apos;t replied is fined.</p>
      )}
      {finesOn && !respondBy && <p className="mt-1 text-[11px] text-slate-500">No deadline, so no fines.</p>}
    </div>
  )
}

const sameMinute = (a: string, b: string) => Math.floor(new Date(a).getTime() / 60_000) === Math.floor(new Date(b).getTime() / 60_000)

/** respond_by + fines_enabled from a form using FinesFields */
export function readFinesFields(fd: FormData) {
  return {
    respond_by: ((fd.get('respond_by') as string | null) ?? '') || null,
    fines_enabled: fd.get('fines_enabled') === 'on',
  }
}
