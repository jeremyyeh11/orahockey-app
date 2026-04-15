'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const NAV = [
  { href: '/dashboard',          label: 'Home',     icon: '🏒' },
  { href: '/dashboard/schedule', label: 'Schedule', icon: '📅' },
  { href: '/dashboard/polls',    label: 'Polls',    icon: '📋' },
  { href: '/dashboard/stats',    label: 'Stats',    icon: '📊' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-surface-border bg-surface-card px-4 py-3">
        <span className="text-lg font-bold tracking-tight text-white">
          ORA Hockey
        </span>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-white transition"
        >
          Logout
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Sticky bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-surface-border bg-surface-card">
        {NAV.map(({ href, label, icon }) => {
          const active =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href)
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
