'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { IconProps } from './icons'
import { CloseIcon } from './icons'

export type NavItem = {
  href: string
  label: string
  Icon: (props: IconProps) => JSX.Element
  /** When true, only an exact pathname match counts as active (e.g. index routes). */
  exact?: boolean
}

function isActive(item: NavItem, pathname: string) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const active = items.find((i) => isActive(i, pathname)) ?? items[0]
  const ActiveIcon = active.Icon

  return (
    <>
      {/* Tap-away backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="relative flex flex-col items-center">
          {/* Popover menu */}
          {open && (
            <div
              role="menu"
              className="glass-strong animate-popin absolute bottom-full mb-3 w-60 overflow-hidden rounded-[26px] p-2"
            >
              {items.map((item) => {
                const activeItem = isActive(item, pathname)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                      activeItem
                        ? 'bg-white/[0.07] text-white'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        activeItem ? 'text-brand-light' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                    {activeItem && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-light shadow-[0_0_8px_rgba(47,158,111,0.8)]" />
                    )}
                  </Link>
                )
              })}
            </div>
          )}

          {/* Center action button — shows the current page's icon */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : `Menu — ${active.label}`}
            aria-expanded={open}
            aria-haspopup="menu"
            className="bg-gold flex h-12 w-12 items-center justify-center rounded-full text-[#0a0a0c] shadow-[0_6px_20px_-4px_rgba(203,161,53,0.55)] ring-1 ring-white/20 transition active:scale-90"
          >
            {open ? (
              <CloseIcon className="h-[19px] w-[19px]" strokeWidth={2.5} />
            ) : (
              <ActiveIcon className="h-[19px] w-[19px]" strokeWidth={2.25} />
            )}
          </button>

          {/* Active page label under the button */}
          <span className="mt-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-500">
            {open ? 'Close' : active.label}
          </span>
        </div>
      </div>
    </>
  )
}
