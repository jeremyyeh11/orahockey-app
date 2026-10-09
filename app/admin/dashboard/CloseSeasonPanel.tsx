'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { fmtDate } from '@/lib/format'
import { LEAGUE } from '@/lib/constants'
import { PHASE_LABEL, SEASON_COOKIE } from '@/lib/season'
import type { CloseSeasonSummary } from '@/lib/season-server'
import { closeSeason } from './seasonActions'
import { unwrap } from '@/lib/action-result'

const CONFIRM_WORD = 'CLOSE'

/**
 * Admin-only Danger zone on Home: close the current season (archive it, start
 * the next). Three deliberate steps: the button → "Yes, close" → type CLOSE.
 */
export default function CloseSeasonPanel({ summary }: { summary: CloseSeasonSummary }) {
  const router = useRouter()
  const [step, setStep] = useState<null | 'confirm' | 'type'>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const name = `${LEAGUE} ${summary.label}`
  const nextName = summary.nextLabel ? `${LEAGUE} ${summary.nextLabel}` : null
  const fixtures =
    summary.fixtures === 0
      ? 'no fixtures yet'
      : `${summary.fixtures} fixture${summary.fixtures === 1 ? '' : 's'}, ${fmtDate(summary.firstFixture!)} – ${fmtDate(summary.lastFixture!)}`

  function closeDialog() {
    if (isPending) return
    setStep(null)
    setTyped('')
    setError(null)
  }

  function handleClose(e: React.FormEvent) {
    e.preventDefault()
    if (typed !== CONFIRM_WORD) return
    setError(null)
    startTransition(async () => {
      try {
        const { newLabel } = await unwrap(closeSeason(typed))
        // Show the new season straight away
        document.cookie = `${SEASON_COOKIE}=${encodeURIComponent(newLabel)}; path=/; samesite=lax`
        setStep(null)
        setTyped('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <section className="liga-danger-zone mt-8 rounded-lg border border-red-900/60 p-4" aria-labelledby="danger-zone-title">
      <h2 id="danger-zone-title" className="liga-section-title text-red-300">Danger zone</h2>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Close {name}</div>
          <p className="liga-meta mt-0.5 text-slate-400">
            {PHASE_LABEL[summary.phase]} · {fixtures}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Archives the season (read-only for everyone) and {nextName ? `starts ${nextName}` : 'starts the next one'}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep('confirm')}
          disabled={!summary.nextLabel}
          className="liga-button min-h-[44px] shrink-0 rounded-lg border border-red-800 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-900/30 disabled:opacity-40"
        >
          Close season
        </button>
      </div>
      {!summary.nextLabel && (
        <p className="mt-2 text-[11px] text-slate-500">This season isn&apos;t labelled with a year — close it from the backend.</p>
      )}

      {step && (
        <Modal onClose={closeDialog}>
          {step === 'confirm' ? (
            <>
              <h2 className="mb-3 text-lg font-bold text-white">Close {name}?</h2>
              <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-slate-300">
                <li>
                  {name} is <span className="font-semibold text-white">archived</span>: nobody — admins included — can
                  change its fixtures, results, squad or attendance in the app.
                </li>
                <li>{nextName} becomes the current season.</li>
                <li>
                  The {summary.carryOver} active player{summary.carryOver === 1 ? '' : 's'} carry over with their jersey
                  numbers.
                </li>
              </ul>
              {summary.phase !== 'post-season' && (
                <p className="liga-alert mb-4 rounded-lg bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
                  {name} is still in {PHASE_LABEL[summary.phase].toLowerCase()}.
                  {summary.upcomingEvents > 0 &&
                    ` ${summary.upcomingEvents} upcoming schedule entr${summary.upcomingEvents === 1 ? 'y' : 'ies'} (games, trainings, events) would be archived with it.`}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep('type')}
                  className="liga-button flex-1 rounded-lg bg-red-800 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Yes, close {summary.label}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleClose}>
              <h2 className="mb-2 text-lg font-bold text-white">Type {CONFIRM_WORD} to confirm</h2>
              <p className="mb-4 text-sm text-slate-400">
                This archives {name} and starts {nextName}. It can only be undone from the backend.
              </p>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={CONFIRM_WORD}
                aria-label={`Type ${CONFIRM_WORD} to confirm`}
                autoComplete="off"
                spellCheck={false}
                className="liga-field mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm tracking-widest text-white placeholder-slate-600 focus:border-red-700 focus:outline-none focus:ring-1 focus:ring-red-700"
              />
              {error && (
                <p className="liga-alert liga-alert-error mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={typed !== CONFIRM_WORD || isPending}
                  className="liga-button flex-1 rounded-lg bg-red-800 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  {isPending ? 'Closing…' : `Close ${summary.label}`}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </section>
  )
}
