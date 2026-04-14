'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '⬛' },
  { href: '/admin/team',      label: 'Team',      icon: '👥' },
  { href: '/admin/schedule',  label: 'Schedule',  icon: '📅' },
  { href: '/admin/stats',     label: 'Stats',     icon: '📊' },
  { href: '/admin/polls',     label: 'Polls',     icon: '📋' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-surface-border bg-surface-card px-4 py-3">
        <span className="text-lg font-bold tracking-tight text-white">
          ORA Hockey <span className="text-xs font-normal text-slate-400">Admin</span>
        </span>
      </header>

      {/* Page content — padded bottom so it isn't hidden behind nav */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Sticky bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-surface-border bg-surface-card">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition ${
                active ? 'text-brand-light' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
