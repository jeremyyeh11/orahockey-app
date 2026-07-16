'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { type NavItem } from '@/components/BottomNav'
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

  const adminViewButton = isAdminPreview ? (
    <button
      onClick={returnToAdmin}
      className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-light transition hover:bg-brand/20"
    >
      Admin view
    </button>
  ) : null

  return (
    <AppShell nav={NAV} headerActions={adminViewButton}>
      {children}
    </AppShell>
  )
}
