'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import BottomNav, { type NavItem } from '@/components/BottomNav'
import { HomeIcon, UsersIcon, CalendarIcon, PollIcon } from '@/components/icons'

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon, exact: true },
  { href: '/dashboard/team', label: 'Squad', Icon: UsersIcon },
  { href: '/dashboard/schedule', label: 'Schedule', Icon: CalendarIcon },
  { href: '/dashboard/polls', label: 'Polls', Icon: PollIcon },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAdminPreview, setIsAdminPreview] = useState(false)

  // Set when an admin switched to player view via the admin control panel
  useEffect(() => {
    setIsAdminPreview(document.cookie.split('; ').includes('ora-view=player'))
  }, [])

  function returnToAdmin() {
    document.cookie = 'ora-view=; path=/; max-age=0'
    router.push('/admin/dashboard')
  }

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-xl">
        <span className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
            <img src="/crest-white.png" alt="ORA Hockey" className="h-full w-full object-cover" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            ORA <span className="text-brand-light">Hockey</span>
          </span>
        </span>
        <div className="flex items-center gap-3">
          {isAdminPreview && (
            <button
              onClick={returnToAdmin}
              className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-light transition hover:bg-brand/20"
            >
              Admin view
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-slate-400 transition hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Page content — padded bottom so it isn't hidden behind the floating nav */}
      <main className="flex-1 overflow-y-auto pb-28">{children}</main>

      {/* Floating pill nav */}
      <BottomNav items={NAV} />
    </div>
  )
}
