'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { preferredName } from '@/lib/names'
import { LEAGUE } from '@/lib/constants'
import { addPlayersToSeason } from './actions'
import { FormButtons } from '@/components/form'
import { unwrap } from '@/lib/action-result'

export type OutsidePlayer = {
  id: string
  full_name: string
  preferred_name: string | null
  jersey_number: number | null
  is_active: boolean
  /** null = pending (no email yet) */
  email: string | null
}

/**
 * Admin-only: add players already on the books (e.g. back after a season out)
 * to the selected open season's squad. A bottom sheet on phones, a centred
 * dialog on desktop (shared Modal). Search shows once the list gets long.
 */
export default function ExistingPlayerPicker({
  seasonLabel,
  players,
  onClose,
}: {
  seasonLabel: string
  players: OutsidePlayer[]
  onClose: () => void
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const q = query.trim().toLowerCase()
  const shown = q
    ? players.filter((p) => `${p.full_name} ${p.preferred_name ?? ''}`.toLowerCase().includes(q))
    : players

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        await unwrap(addPlayersToSeason(picked))
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <Modal onClose={onClose} scrollable>
      <h2 className="mb-1 text-lg font-bold text-white">Add existing players</h2>
      <p className="mb-4 text-sm text-slate-400">
        Players on the books who aren&apos;t in the {LEAGUE} {seasonLabel} squad.
      </p>

      {players.length > 8 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          aria-label="Search players"
          className="liga-field mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      )}

      {players.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Everyone is already in this season&apos;s squad.</p>
      ) : (
        <ul className="liga-existing-players mb-4 divide-y divide-white/5" aria-label="Players not in this season">
          {shown.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={picked.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 rounded accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium text-white">{preferredName(p)}</span>
                  <span className="liga-meta block text-[11px] text-slate-500">
                    {p.full_name}
                    {p.jersey_number != null ? ` · #${p.jersey_number}` : ''}
                    {!p.is_active ? ' · inactive' : ''}
                    {!p.email ? ' · pending' : ''}
                  </span>
                </span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No match.</li>}
        </ul>
      )}

      {error && (
        <p className="liga-alert liga-alert-error mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <FormButtons
        isPending={isPending}
        disabled={picked.length === 0}
        onCancel={onClose}
        onConfirm={submit}
        label={picked.length > 0 ? `Add ${picked.length} to ${seasonLabel}` : `Add to ${seasonLabel}`}
        pendingLabel="Adding…"
      />
    </Modal>
  )
}
