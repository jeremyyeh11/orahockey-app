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
              className="menu-dock animate-popin absolute bottom-full mb-3 flex w-60 flex-col gap-1 overflow-hidden p-2"
            >
              {items.map((item) => {
                const activeItem = isActive(item, pathname)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`menu-item flex items-center gap-3 ${
                      activeItem ? 'is-active' : ''
                    }`}
                  >
                    <item.Icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
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
            className="bg-accent flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.7)] ring-1 ring-white/10 transition active:scale-90"
          >
            {open ? (
              <CloseIcon className="h-[19px] w-[19px]" strokeWidth={2.5} />
            ) : (
              <ActiveIcon className="h-[19px] w-[19px]" strokeWidth={2.25} />
            )}
          </button>

          {/* Active page label under the button */}
          <span className="menu-label mt-1.5 uppercase tracking-widest">
            {open ? 'Close' : active.label}
          </span>
        </div>
      </div>
    </>
  )
}
