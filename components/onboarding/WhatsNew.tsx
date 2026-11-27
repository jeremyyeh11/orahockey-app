'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import { fmtDayMonthYear } from '@/lib/format'
import type { Release } from '@/lib/whats-new'

/**
 * What's new: one card per feature (screenshot, title, a line or two on how to
 * use it) across the given releases, newest first. Next / Back or swipe;
 * an item with `action: 'tour'` gets a "Take the tour" button.
 */
export default function WhatsNew({
  releases,
  onClose,
  onTour,
}: {
  releases: Release[]
  onClose: () => void
  onTour: () => void
}) {
  const items = releases.flatMap((r) => r.items.map((item) => ({ ...item, date: r.date })))
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const item = items[index]
  if (!item) return null
  const last = index === items.length - 1
  const next = () => (last ? onClose() : setIndex(index + 1))
  const back = () => setIndex(Math.max(0, index - 1))

  return (
    <Modal onClose={onClose} scrollable>
      <div
        className="liga-whats-new"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (dx < -50 && !last) next()
          else if (dx > 50) back()
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="liga-section-title">What&apos;s new</div>
          <div className="liga-meta text-slate-500">{fmtDayMonthYear(item.date)}</div>
        </div>
        <h2 className="mt-2 text-lg font-bold text-white">{item.title}</h2>
        {item.image && (
          // Screenshots are plain files in public/whats-new; next/image adds nothing here
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            className="liga-whats-new-shot mt-3 max-h-[45vh] w-full rounded-xl border border-surface-border bg-black/30 object-contain"
          />
        )}
        <p className="mt-3 text-sm leading-snug text-slate-300">{item.body}</p>
        {item.action === 'tour' && (
          <button
            type="button"
            onClick={onTour}
            className="liga-button liga-button-primary bg-accent mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
          >
            Take the tour
          </button>
        )}

        <div className="mt-5 flex items-center gap-2">
          {items.length > 1 && (
            <div className="flex gap-1.5" aria-label={`${index + 1} of ${items.length}`}>
              {items.map((_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-brand-light' : 'bg-slate-600'}`} />
              ))}
            </div>
          )}
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button type="button" onClick={back} className="liga-button liga-button-secondary rounded-xl px-4 text-sm font-semibold text-slate-300">
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              // Under "Take the tour" the green button is the tour, so Next steps back
              className={
                item.action
                  ? 'liga-button liga-button-secondary rounded-xl px-5 text-sm font-semibold text-slate-300'
                  : 'liga-button liga-button-primary rounded-xl bg-brand px-5 text-sm font-semibold text-white ring-1 ring-white/10'
              }
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
