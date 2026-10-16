'use client'

import AppShell from '@/components/AppShell'
import { type NavItem } from '@/components/BottomNav'
import { type SeasonNav } from '@/components/SeasonSwitcher'
import AdminBadge from '@/components/AdminControlPanel'
import type { ViewerRole } from '@/lib/supabase/request-user'
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  PollIcon,
  ReceiptIcon,
  UserIcon,
} from '@/components/icons'

const NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Home', Icon: HomeIcon, exact: true },
  { href: '/admin/schedule', label: 'Schedule', Icon: CalendarIcon },
  { href: '/admin/polls', label: 'Polls', Icon: PollIcon },
  { href: '/admin/team', label: 'Squad', Icon: UsersIcon },
  { href: '/admin/fines', label: 'Fines', Icon: ReceiptIcon },
  { href: '/admin/profile', label: 'Profile', Icon: UserIcon },
]

export default function AdminShell({
  seasonNav,
  viewer,
  debug,
  children,
}: {
  seasonNav: SeasonNav | null
  /** Your role and titles: your tag in the top bar */
  viewer: ViewerRole
  /** Superadmin: double-tapping ADMIN opens debug mode */
  debug: boolean
  children: React.ReactNode
}) {
  return (
    <AppShell nav={NAV} titleExtra={<AdminBadge viewer={viewer} debug={debug} />} seasonNav={seasonNav}>
      {children}
    </AppShell>
  )
}
