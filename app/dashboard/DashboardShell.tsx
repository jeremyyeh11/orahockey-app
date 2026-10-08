'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { startNavigationProgress } from '@/components/NavigationProgress'
import { type NavItem } from '@/components/BottomNav'
import { type SeasonNav } from '@/components/SeasonSwitcher'
import { HomeIcon, UsersIcon, CalendarIcon, PollIcon, ReceiptIcon } from '@/components/icons'

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon, exact: true },
  { href: '/dashboard/schedule', label: 'Schedule', Icon: CalendarIcon },
  { href: '/dashboard/polls', label: 'Polls', Icon: PollIcon },
  { href: '/dashboard/team', label: 'Squad', Icon: UsersIcon },
  { href: '/dashboard/fines', label: 'Fines', Icon: ReceiptIcon },
]

export default function DashboardShell({
  seasonNav,
  children,
}: {
  seasonNav: SeasonNav | null
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
    startNavigationProgress()
    router.push('/admin/dashboard')
  }

  const adminViewButton = isAdminPreview ? (
    <button
      onClick={returnToAdmin}
      className="liga-compact-button liga-button-secondary ml-1 border border-brand/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-light transition hover:text-white"
    >
      Admin view
    </button>
  ) : null

  return (
    <AppShell nav={NAV} headerActions={adminViewButton} seasonNav={seasonNav}>
      {children}
    </AppShell>
  )
}
