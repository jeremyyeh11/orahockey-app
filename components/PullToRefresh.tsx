'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Pull-to-refresh for the standalone PWA. Installed to the iOS home screen the app
 * runs with no browser chrome, so there's no reload button — dragging down from the
 * top of the scroll area and releasing past the threshold triggers a full
 * `window.location.reload()` (the browser-reload equivalent, not a soft router refresh).
 *
 * Renders the scrollable <main> so it owns the scroll container. Two iOS gotchas drive
 * the shape of this:
 *   1. If the first downward touchmove isn't preventDefault()-ed, Safari commits the
 *      gesture to its native rubber-band and then ignores later preventDefault — so we
 *      claim the gesture on the very first downward move, no direction-lock delay.
 *   2. The spinner is position:fixed (not a child of the overflow container) so it's
 *      never clipped and always shows at the top while pulling / reloading.
 */
const THRESHOLD = 70 // px of pull needed to trigger a reload
const MAX_PULL = 120 // px the indicator can travel
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
  // True while the content springs back after a released (sub-threshold) pull —
  // keeps the transform on just long enough for the return animation.
  const [settling, setSettling] = useState(false)

  // Live gesture state in refs so the listeners register once (depending on `pull`
  // here would re-run the effect every frame and reset the drag mid-gesture).
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    let startY = 0
    let startX = 0
    let tracking = false // finger down while at the top
    let pulling = false // committed to a downward pull

    const setPullDist = (d: number) => {
      pullRef.current = d
      setPull(d)
    }

    // At the top regardless of whether <main> or the document is the actual scroller.
    const atTop = () => el.scrollTop <= 0 && window.scrollY <= 0
    const modalOpen = () => document.documentElement.dataset.modalOpen === 'true'

    const onStart = (e: TouchEvent) => {
      if (modalOpen() || refreshingRef.current || e.touches.length !== 1 || !atTop()) {
        tracking = false
        return
      }
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      tracking = true
      pulling = false
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking || refreshingRef.current) return
      if (modalOpen()) {
        tracking = false
        pulling = false
        setPullDist(0)
        return
      }
      const dy = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX

      if (!pulling) {
        if (dy <= 0) {
          // Upward / no vertical movement yet — let native scrolling happen.
          if (dy < 0) tracking = false
          return
        }
        // Clearly horizontal — don't hijack side swipes.
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
          tracking = false
          return
        }
        pulling = true
      }

      // Downward pull at the top: take over from iOS's native overscroll immediately.
      e.preventDefault()
      setPullDist(Math.min(dy * RESISTANCE, MAX_PULL))
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (pulling && pullRef.current >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullDist(THRESHOLD)
        window.location.reload()
      } else {
        if (pullRef.current > 0) setSettling(true)
        setPullDist(0)
      }
      pulling = false
    }

    // Non-passive touchmove so onMove can preventDefault the native overscroll bounce.
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
  const visible = pull > 0 || refreshing

  return (
    <>
      {/* Fixed spinner pinned near the top — never clipped by the scroll container.
          Fades and slides in as you pull; spins while the reload is in flight. */}
      <div
        aria-hidden={!visible}
        className="pointer-events-none fixed inset-x-0 top-[64px] z-40 flex justify-center"
        style={{
          transform: `translateY(${(refreshing ? THRESHOLD : pull) * 0.35}px)`,
          opacity: refreshing ? 1 : progress,
          transition: !visible ? 'transform 0.2s, opacity 0.2s' : 'none',
        }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface-card shadow-lg shadow-black/40">
          <svg
            className={`h-5 w-5 text-brand-light ${refreshing ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            style={{
              transform: refreshing ? undefined : `rotate(${ready ? 180 : progress * 180}deg)`,
              transition: refreshing ? undefined : 'transform 0.1s',
            }}
          >
            {refreshing ? (
              <>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : (
              <path
                d="M12 5v14M12 19l-5-5M12 19l5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </span>
      </div>

      <main ref={mainRef} className={className} style={{ overscrollBehaviorY: 'contain' }}>
        {/* Content follows the finger, then springs back on release.
            IMPORTANT: the transform is only applied while a pull is in flight.
            A permanent transform (even translateY(0)) makes this div the
            containing block for every position:fixed descendant — which
            collapses fixed-layer pages like the player profile hero and can
            misplace modals. Idle = no transform = fixed works normally. */}
        <div
          style={{
            transform:
              pull > 0 || refreshing || settling
                ? `translateY(${refreshing ? THRESHOLD : pull}px)`
                : undefined,
            transition: pull === 0 && !refreshing ? 'transform 0.25s' : 'none',
          }}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && e.propertyName === 'transform') {
              setSettling(false)
            }
          }}
        >
          {children}
        </div>
      </main>
    </>
  )
}
