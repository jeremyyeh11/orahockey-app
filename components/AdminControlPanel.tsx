'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { startNavigationProgress } from '@/components/NavigationProgress'
import { RoleTag } from '@/components/RoleTag'
import type { ViewerRole } from '@/lib/supabase/request-user'

const PREVIEW_COOKIE = 'ora-preview-date'
const VIEW_COOKIE = 'ora-view'

function getCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith(name + '='))
    ?.split('=')[1]
}
function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`
}
function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

/**
 * Your role tag in the admin top bar: your titles (Coaching, ...), Admin, or
 * the Superadmin chip. For superadmins, double-tapping it opens debug mode:
 * switch to player view, or set a preview date that the whole app renders
 * against (for testing). For other admins it's a plain tag.
 */
export default function AdminBadge({ viewer, debug }: { viewer: ViewerRole; debug: boolean }) {
  const tag = <RoleTag role={viewer.role} titles={viewer.titles} />
  if (!debug) return <span className="ml-2">{tag}</span>
  return <DebugBadge tag={tag} />
}

function DebugBadge({ tag }: { tag: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [previewDate, setPreviewDate] = useState<string | null>(null)
  const [dateInput, setDateInput] = useState('')
  const lastTap = useRef(0)

  // Read the cookie after mount only — avoids SSR/client mismatch
  useEffect(() => {
    setPreviewDate(getCookie(PREVIEW_COOKIE) ?? null)
  }, [open])

  function handleTap() {
    const t = Date.now()
    if (t - lastTap.current < 400) {
      lastTap.current = 0
      setDateInput(getCookie(PREVIEW_COOKIE) ?? '')
      setOpen(true)
    } else {
      lastTap.current = t
    }
  }

  function switchToPlayerView() {
    setCookie(VIEW_COOKIE, 'player')
    setOpen(false)
    startNavigationProgress()
    router.push('/dashboard')
  }

  function applyDate() {
    if (!dateInput) return
    setCookie(PREVIEW_COOKIE, dateInput)
    setPreviewDate(dateInput)
    router.refresh()
  }

  function clearDate() {
    clearCookie(PREVIEW_COOKIE)
    setPreviewDate(null)
    setDateInput('')
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        className="ml-2 text-[10px] font-semibold transition hover:brightness-125"
      >
        {tag}
        {previewDate && <span className="ml-1.5 text-amber-400">· {previewDate}</span>}
      </button>

      {/* Portal to <body>: the sticky header's backdrop-blur creates a
          containing block that would otherwise trap this fixed overlay */}
      {open &&
        createPortal(
        <Modal onClose={() => setOpen(false)}>
          <h2 className="text-lg font-bold text-white">Debug mode</h2>
          <p className="mt-0.5 text-xs text-slate-500">Superadmin testing tools — double-tap your tag in the top bar to open this panel.</p>

          {/* View switcher */}
          <div className="mt-5">
            <div className="mb-1.5 text-xs font-medium text-slate-400">View as</div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="liga-button liga-button-primary bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10"
              >
                Admin
              </button>
              <button
                onClick={switchToPlayerView}
                className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
              >
                Player
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Player view shows the player dashboard as your own account. Use the button in the top bar to return.
            </p>
          </div>

          {/* Preview date */}
          <div className="mt-5">
            <div className="mb-1.5 text-xs font-medium text-slate-400">Preview date</div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="liga-field h-[42px] flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                onClick={applyDate}
                disabled={!dateInput}
                className="liga-button liga-button-primary bg-accent rounded-lg px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
            {previewDate ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-900/30 px-3 py-2">
                <span className="text-xs text-amber-300">App is rendering as of {previewDate} (noon SGT)</span>
                <button onClick={clearDate} className="text-xs font-semibold text-amber-300 underline">
                  Reset
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Pages render as if today were the selected date — schedules, records, polls.
              </p>
            )}
          </div>

          <button
            onClick={() => setOpen(false)}
            className="liga-button liga-button-secondary mt-6 w-full rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
          >
            Close
          </button>
        </Modal>,
        document.body
      )}
    </>
  )
}
