'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

let startListener: (() => void) | null = null

/** Start the bar for a programmatic navigation — call just before `router.push`. */
export function startNavigationProgress() {
  startListener?.()
}

/**
 * Thin progress bar along the top of the viewport while a route loads. The App
 * Router has no navigation events, so it starts on a click on an internal link to
 * another path (or via `startNavigationProgress`) and finishes when the pathname
 * changes. Most useful where nothing else moves while the server renders — e.g.
 * opening a player from Squad, which can take a second or two.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')

  useEffect(() => {
    const start = () => setState('loading')
    startListener = start

    // Capture phase: next/link calls preventDefault() on the way up, so a bubbling
    // listener would see every in-app link click as already handled.
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest('a') : null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      // External links and same-page links don't navigate the app
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      start()
    }

    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      if (startListener === start) startListener = null
    }
  }, [])

  // The new route has rendered: run the bar to the end, then hide it
  useEffect(() => {
    setState((s) => (s === 'loading' ? 'done' : s))
  }, [pathname])

  useEffect(() => {
    if (state === 'idle') return
    // 'done' fades out; 'loading' gives up after 10s (navigation failed or was cancelled)
    const t = setTimeout(() => setState('idle'), state === 'done' ? 300 : 10_000)
    return () => clearTimeout(t)
  }, [state])

  return (
    <div aria-hidden className="liga-nav-progress pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className={`h-full bg-brand-light ease-out ${
          state === 'idle'
            ? 'w-0 opacity-0'
            : state === 'loading'
              ? 'w-[85%] opacity-100 transition-[width] duration-[8000ms]'
              : 'w-full opacity-0 transition-[width,opacity] duration-300'
        }`}
      />
    </div>
  )
}
