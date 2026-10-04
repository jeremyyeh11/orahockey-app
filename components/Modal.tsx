'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Literal classes so Tailwind generates them. Desktop (lg+) gets one step wider.
const WIDTH = {
  sm: 'sm:max-w-sm lg:max-w-md',
  md: 'sm:max-w-md lg:max-w-lg',
}

// Modals that open over another modal (team list, match result) sit above it.
const LAYER = {
  base: 'z-[70]',
  top: 'z-[80]',
}

// Open panels, innermost last — Esc and Tab only act on the top one.
const openPanels: HTMLElement[] = []
let titleSeq = 0

/**
 * Shared dialog shell: dimmed backdrop, bottom sheet on phones, centred panel
 * from `sm`. Owns the page scroll lock and dialog behaviour:
 *  - Esc or a backdrop click calls `onClose`
 *  - focus moves into the panel on open, Tab stays inside it, and focus returns
 *    to whatever opened it on close
 *  - `role="dialog"`, labelled by the panel's first heading
 */
export default function Modal({
  onClose,
  size = 'sm',
  layer = 'base',
  scrollable = false,
  children,
}: {
  onClose: () => void
  size?: keyof typeof WIDTH
  layer?: keyof typeof LAYER
  /** Cap at 90vh and scroll inside — for long content. */
  scrollable?: boolean
  children: ReactNode
}) {
  useModalScrollLock()
  const panelRef = useRef<HTMLDivElement>(null)
  // Latest onClose without re-running the open/close effect on every render
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openPanels.push(panel)

    const heading = panel.querySelector('h1, h2, h3')
    if (heading) {
      if (!heading.id) heading.id = `modal-title-${++titleSeq}`
      panel.setAttribute('aria-labelledby', heading.id)
    }
    panel.focus({ preventScroll: true })

    function onKeyDown(e: KeyboardEvent) {
      if (openPanels[openPanels.length - 1] !== panel) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!panel.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openPanels.splice(openPanels.indexOf(panel), 1)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div className={`liga-modal fixed inset-0 ${LAYER[layer]} flex items-end justify-center p-0 sm:items-center sm:p-4`}>
      <div className="liga-modal-backdrop absolute inset-0 bg-black/70" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`liga-modal-panel relative w-full rounded-t-2xl border border-surface-border bg-surface-card px-6 pb-8 pt-6 shadow-xl outline-none sm:rounded-2xl ${WIDTH[size]} ${
          scrollable ? 'max-h-[90vh] overflow-y-auto scrollbar-hide' : ''
        }`}
      >
        <div className="liga-modal-handle mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
        {children}
      </div>
    </div>
  )
}
