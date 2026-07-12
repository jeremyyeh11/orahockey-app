'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { IconProps } from './icons'

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <nav className="menu-dock flex items-center gap-0.5 p-1.5">
        {items.map((item) => {
          const active = isActive(item, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex h-10 items-center rounded-full transition-colors duration-300 ${
                active
                  ? 'bg-brand px-3.5 text-white ring-1 ring-white/10'
                  : 'px-[11px] text-slate-400 hover:text-white'
              }`}
            >
              <item.Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 2} />
              {/* Label expands/collapses so the pill morphs smoothly between tabs */}
              <span
                className={`overflow-hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide transition-all duration-300 ease-out ${
                  active ? 'ml-1.5 max-w-[8rem] opacity-100' : 'ml-0 max-w-0 opacity-0'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
