'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isActive, type NavItem } from './BottomNav'

/**
 * Desktop (lg+) primary nav, rendered inside the app header. Same items as the
 * BottomNav, but every link shows its label — on a wide screen there's room, and
 * icon-only links with no hover tooltip are guesswork with a mouse.
 */
export default function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="liga-top-nav ml-8 hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const active = isActive(item, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
              active ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <item.Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 2} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
