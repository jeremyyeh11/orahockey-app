'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { RoleTag } from '@/components/RoleTag'
import type { ViewerRole } from '@/lib/supabase/request-user'
import { startNavigationProgress } from '@/components/NavigationProgress'
import { type NavItem } from '@/components/BottomNav'
import { type SeasonNav } from '@/components/SeasonSwitcher'
import { HomeIcon, UsersIcon, CalendarIcon, PollIcon, ReceiptIcon, UserIcon } from '@/components/icons'

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon, exact: true },
  { href: '/dashboard/schedule', label: 'Schedule', Icon: CalendarIcon },
  { href: '/dashboard/polls', label: 'Polls', Icon: PollIcon },
  { href: '/dashboard/team', label: 'Squad', Icon: UsersIcon },
  { href: '/dashboard/fines', label: 'Fines', Icon: ReceiptIcon },
  { href: '/dashboard/profile', label: 'Profile', Icon: UserIcon },
]

export default function DashboardShell({
  seasonNav,
  viewer,
  children,
}: {
  seasonNav: SeasonNav | null
  /** Your role and titles: your tag in the top bar (Finemaster, Equipment, ...) */
  viewer: ViewerRole
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAdminPreview, setIsAdminPreview] = useState(false)

  // Set when a superadmin switched to player view via debug mode
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
    <AppShell
      nav={NAV}
      titleExtra={<RoleTag role={viewer.role} titles={viewer.titles} className="ml-2" />}
      headerActions={adminViewButton}
      seasonNav={seasonNav}
    >
      {children}
    </AppShell>
  )
}
