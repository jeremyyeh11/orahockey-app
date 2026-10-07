'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SEASON_COOKIE, seasonTitle, type Season } from '@/lib/season'
import { CheckIcon, ChevronDownIcon, LockIcon } from './icons'
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

/**
 * Desktop (lg+): season dropdown in the header, next to Logout. A custom listbox
 * (not a native <select>) so the open menu matches the app: dark card, green bar
 * on the selected season, a Current tag, a lock on archived seasons, All time on
 * top with a divider.
 * Keyboard: ↑/↓ (or Home/End) to move, Enter/Space to pick, Esc to close.
 */
export function SeasonMenu({ seasons, selectedId }: SeasonNav) {
  const { activeId, select, isPending } = useSeasonSwitch(selectedId)
  const active = seasons.find((s) => s.id === activeId)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  // Click outside closes it
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function openMenu() {
    setHighlight(Math.max(0, seasons.findIndex((s) => s.id === activeId)))
    setOpen(true)
    requestAnimationFrame(() => listRef.current?.focus())
  }

  function close(focusButton = true) {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  function choose(s: Season) {
    select(s)
    close()
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    const last = seasons.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlight((i) => Math.min(last, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlight((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setHighlight(0)
        break
      case 'End':
        e.preventDefault()
        setHighlight(last)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (seasons[highlight]) choose(seasons[highlight])
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className="liga-season-menu relative hidden items-center lg:flex">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Season: ${active ? seasonName(active) : ''}`}
        aria-busy={isPending || undefined}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            openMenu()
          }
        }}
        className={`liga-season-trigger flex min-h-[44px] items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-medium text-white transition-colors hover:border-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-light ${
          open ? 'border-slate-500' : 'border-surface-border'
        }`}
      >
        {isArchived(active) && <LockIcon aria-hidden className="h-3.5 w-3.5 text-amber-300" />}
        <span>{active ? seasonName(active) : 'Season'}</span>
        <ChevronDownIcon
          aria-hidden
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Season"
        tabIndex={-1}
        hidden={!open}
        aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
        onKeyDown={onListKeyDown}
        className="liga-season-list absolute right-0 top-full z-50 mt-1.5 min-w-[13rem] overflow-hidden rounded-lg border border-surface-border bg-surface-card py-1 shadow-xl shadow-black/50 focus:outline-none"
      >
        {seasons.map((s, i) => {
          const selected = s.id === activeId
          return (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={selected}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(s)}
              className={`liga-season-option flex min-h-[40px] cursor-pointer items-center gap-2 px-3 text-sm ${
                i === highlight ? 'bg-white/[0.06]' : ''
              } ${selected ? 'font-medium text-white shadow-[inset_3px_0_0_#5aa971]' : 'text-slate-300'} ${
                s.allTime ? 'border-b border-surface-border' : ''
              }`}
            >
              <span className="flex-1 whitespace-nowrap">{seasonName(s)}</span>
              {s.is_current && <span className="liga-meta text-[11px] text-brand-light">Current</span>}
              {/* Archived: just the lock (the word is for screen readers) */}
              {isArchived(s) && (
                <span className="inline-flex items-center text-slate-500">
                  <LockIcon aria-hidden className="h-3.5 w-3.5" />
                  <span className="sr-only">Archived</span>
                </span>
              )}
              <CheckIcon aria-hidden className={`h-4 w-4 shrink-0 text-brand-light ${selected ? '' : 'invisible'}`} />
            </li>
          )
        })}
      </ul>
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
