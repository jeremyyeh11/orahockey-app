'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SEASON_COOKIE, seasonTitle, type Season } from '@/lib/season'
import { LockIcon } from './icons'
import { finishNavigationProgress, startNavigationProgress } from './NavigationProgress'

export type SeasonNav = { seasons: Season[]; selectedId: string }

/**
 * Switching season stores the pick in a session cookie and re-renders the
 * server pages, which all read it. The picked season highlights immediately
 * while its data loads (top progress bar runs meanwhile).
 */
function useSeasonSwitch(selectedId: string) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (isPending || !started.current) return
    started.current = false
    setPendingId(null)
    finishNavigationProgress()
  }, [isPending])

  function select(season: Season) {
    if (season.id === (pendingId ?? selectedId)) return
    document.cookie = `${SEASON_COOKIE}=${encodeURIComponent(season.label)}; path=/; samesite=lax`
    setPendingId(season.id)
    started.current = true
    startNavigationProgress()
    startTransition(() => router.refresh())
  }

  return { activeId: pendingId ?? selectedId, select, isPending }
}

const seasonName = seasonTitle

/** An archived season (the lock icon) — not the "All time" view, which is view-only too */
const isArchived = (s: Season | undefined) => !!s?.locked && !s.allTime

/** Desktop (lg+): compact dropdown in the header, next to Logout. */
export function SeasonMenu({ seasons, selectedId }: SeasonNav) {
  const { activeId, select, isPending } = useSeasonSwitch(selectedId)
  const active = seasons.find((s) => s.id === activeId)

  return (
    <div className="liga-season-menu relative hidden items-center lg:flex">
      {isArchived(active) && (
        <LockIcon aria-hidden className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-amber-300" />
      )}
      <select
        aria-label="Season"
        aria-busy={isPending || undefined}
        value={activeId}
        onChange={(e) => {
          const s = seasons.find((x) => x.id === e.target.value)
          if (s) select(s)
        }}
        className={`liga-season-select min-h-[44px] cursor-pointer rounded-lg border border-surface-border bg-surface py-2 pr-3 text-sm font-medium text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${
          isArchived(active) ? 'pl-8' : 'pl-3'
        }`}
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {seasonName(s)}
            {s.allTime ? '' : s.locked ? ' · Archived' : s.is_current ? ' · Current' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Touch layouts (< lg): a row of season tabs under the header (sticky with it),
 * scrollable sideways once there are many seasons. A locked season shows a
 * "Read-only" tag at the end of the row.
 */
export function SeasonTabs({ seasons, selectedId }: SeasonNav) {
  const { activeId, select } = useSeasonSwitch(selectedId)
  const active = seasons.find((s) => s.id === activeId)

  return (
    <div className="liga-season-bar border-t border-white/10 lg:hidden">
      <div className="flex items-center gap-3 px-4">
        <div
          role="group"
          aria-label="Season"
          className="flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto scrollbar-hide"
        >
          {seasons.map((s) => {
            const on = s.id === activeId
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => select(s)}
                className={`liga-tab liga-season-tab flex min-h-[44px] shrink-0 snap-start items-center gap-1.5 border-b-2 px-3 text-xs font-semibold transition-colors ${
                  on ? 'border-brand-light text-white' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {isArchived(s) && <LockIcon aria-hidden className="h-3 w-3" />}
                {seasonName(s)}
              </button>
            )
          }).flatMap((tab, i) =>
            // Thin divider between "All time" (first) and the seasons
            seasons[i]?.allTime ? [tab, <span key="all-divider" aria-hidden className="my-3 w-px shrink-0 bg-white/10" />] : [tab]
          )}
        </div>
        {active?.locked && (
          <span className="liga-meta inline-flex shrink-0 items-center gap-1 text-[11px] text-amber-300">
            {!active.allTime && <LockIcon aria-hidden className="h-3 w-3" />}
            {active.allTime ? 'View only' : 'Read-only'}
          </span>
        )}
      </div>
    </div>
  )
}

/** Desktop (lg+): slim strip under the header row while a locked season is showing. */
export function LockedSeasonStrip({ seasons, selectedId }: SeasonNav) {
  const season = seasons.find((s) => s.id === selectedId)
  if (!season?.locked) return null
  return (
    <div className="liga-locked-strip hidden border-t border-white/10 lg:block">
      <div className="app-container flex items-center gap-2 px-4 py-1.5 text-xs text-amber-300">
        {season.allTime ? (
          <span>
            All time — every season combined. <span className="font-semibold">View only</span>; pick a season to make changes.
          </span>
        ) : (
          <>
            <LockIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span>
              {seasonName(season)} is a past season — <span className="font-semibold">read-only</span>.
            </span>
          </>
        )}
      </div>
    </div>
  )
}
