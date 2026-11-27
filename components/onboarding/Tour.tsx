'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import type { TourStep } from '@/lib/tour'

const GUTTER = 16
const PAD = 6
const CARD_W = 340

type Box = { top: number; left: number; width: number; height: number }

/** The visible element for a data-tour target: the nav has a phone and a desktop copy */
export function findTarget(target: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`))
  return all.find((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }) ?? null
}

/**
 * The first-time tour: dims the page, cuts a spotlight around one target at a
 * time and shows a caption beside it. Tap anywhere (or Next, →, Enter) to go
 * on; Back / ←; Skip / Esc ends it. Steps whose target isn't on the page are
 * dropped when it opens.
 */
export default function Tour({ steps: allSteps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  useModalScrollLock()
  const [steps] = useState(() => allSteps.filter((s) => !s.target || findTarget(s.target)))
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [view, setView] = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  const measure = useCallback(() => {
    setView({ w: window.innerWidth, h: window.innerHeight })
    const el = step?.target ? findTarget(step.target) : null
    if (!el) return setBox(null)
    const r = el.getBoundingClientRect()
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step])

  // Bring the target on screen, then measure it
  useLayoutEffect(() => {
    const el = step?.target ? findTarget(step.target) : null
    el?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    measure()
    // Focus the caption (not Next) so screen readers read it and no focus ring shows on a tap
    cardRef.current?.focus({ preventScroll: true })
  }, [step, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  const next = useCallback(() => (last ? onDone() : setIndex((i) => i + 1)), [last, onDone])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [next, back, onDone])

  if (!step) return null

  // Caption: on the side of the target with more room; centred with no target
  const cardW = Math.min(CARD_W, view.w - GUTTER * 2)
  let cardStyle: React.CSSProperties
  if (!box) {
    cardStyle = { width: cardW, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  } else {
    const centre = box.left + box.width / 2
    const left = Math.min(Math.max(centre - cardW / 2, GUTTER), view.w - GUTTER - cardW)
    const above = box.top > view.h - (box.top + box.height)
    cardStyle = above
      ? { width: cardW, left, bottom: Math.max(view.h - box.top + 12, GUTTER) }
      : { width: cardW, left, top: Math.min(box.top + box.height + 12, view.h - GUTTER) }
  }

  return (
    <div className="liga-tour fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="App tour" style={{ touchAction: 'none' }}>
      {/* Tap anywhere to go on */}
      <div className="absolute inset-0" onClick={next} aria-hidden="true" />
      {box ? (
        <div
          // A border, not a ring: Tailwind rings are box-shadows, which this shadow (the dimming) would replace
          className="liga-tour-spotlight pointer-events-none absolute rounded-xl border-2 border-brand-light transition-all duration-300 ease-out"
          style={{ ...box, boxShadow: '0 0 0 200vmax rgba(0, 0, 0, 0.78)' }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/[0.78]" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="liga-tour-card absolute rounded-2xl border border-surface-border bg-surface-card p-4 shadow-xl outline-none transition-all duration-300 ease-out"
        style={cardStyle}
        aria-live="polite"
      >
        <div className="liga-meta text-slate-500">
          {index + 1} / {steps.length}
        </div>
        <h2 className="mt-1 text-base font-bold text-white">{step.title}</h2>
        <p className="mt-1 text-sm leading-snug text-slate-300">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <button type="button" onClick={onDone} className="min-h-[44px] px-1 text-xs font-semibold text-slate-400 hover:text-white">
              Skip
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="liga-button liga-button-secondary rounded-xl px-4 text-sm font-semibold text-slate-300"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="liga-button liga-button-primary rounded-xl bg-brand px-5 text-sm font-semibold text-white ring-1 ring-white/10"
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
