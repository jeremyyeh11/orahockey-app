'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Pull-to-refresh for the standalone PWA. Installed to the iOS home screen the app
 * runs with no browser chrome, so there's no reload button — dragging down from the
 * top of the scroll area and releasing past the threshold triggers a full
 * `window.location.reload()` (the browser-reload equivalent, not a soft router refresh).
 *
 * Renders the scrollable <main> itself so it owns the scroll container: the gesture
 * only engages when that container is at the very top (scrollTop <= 0) and the drag is
 * clearly vertical, so it never hijacks normal scrolling or horizontal swipes.
 */
const THRESHOLD = 70 // px of pull needed to trigger a reload
const MAX_PULL = 110 // px the indicator can travel
const RESISTANCE = 0.5 // drag feels heavier than the finger

export default function PullToRefresh({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const mainRef = useRef<HTMLElement>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Live gesture state kept in refs so the listeners register once (depending on
  // `pull` here would re-run the effect every frame and reset the drag mid-gesture).
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    let startY = 0
    let startX = 0
    let active = false // engaged a valid pull-from-top gesture
    let decided = false // locked in vertical (vs horizontal) intent

    const setPullDist = (d: number) => {
      pullRef.current = d
      setPull(d)
    }

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || el.scrollTop > 0 || e.touches.length !== 1) {
        active = false
        return
      }
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      active = true
      decided = false
    }

    const onMove = (e: TouchEvent) => {
      if (!active || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX

      if (!decided) {
        // Ignore until the gesture shows a clear direction.
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return
        // Horizontal or upward — not a pull-to-refresh; let the browser handle it.
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0) {
          active = false
          return
        }
        decided = true
      }

      if (dy <= 0) {
        setPullDist(0)
        return
      }
      // Pulling down at the top: take over from the native rubber-band.
      e.preventDefault()
      setPullDist(Math.min(dy * RESISTANCE, MAX_PULL))
    }

    const onEnd = () => {
      if (!active) return
      active = false
      if (pullRef.current >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullDist(THRESHOLD)
        window.location.reload()
      } else {
        setPullDist(0)
      }
    }

    // Non-passive so onMove can preventDefault the native overscroll bounce.
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const progress = Math.min(pull / THRESHOLD, 1)
  const ready = pull >= THRESHOLD

  return (
    <main
      ref={mainRef}
      className={className}
      style={{ overscrollBehaviorY: 'contain' }}
    >
      {/* Pull indicator, revealed in the space above the content as it slides down. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{
          transform: `translateY(${pull - 40}px)`,
          opacity: refreshing ? 1 : progress,
          transition: pull === 0 && !refreshing ? 'transform 0.2s, opacity 0.2s' : 'none',
        }}
      >
        <span className="mt-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-surface-card shadow-lg">
          <svg
            className={`h-4 w-4 text-brand-light ${refreshing ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            style={{
              transform: refreshing ? undefined : `rotate(${ready ? 180 : progress * 180}deg)`,
            }}
          >
            {refreshing ? (
              <>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : (
              <path
                d="M12 5v14M12 19l-5-5M12 19l5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </span>
      </div>

      {/* Content follows the finger, then springs back on release. */}
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: pull === 0 && !refreshing ? 'transform 0.2s' : 'none',
        }}
      >
        {children}
      </div>
    </main>
  )
}
