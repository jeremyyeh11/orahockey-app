'use client'

import AppShell from '@/components/AppShell'
import { type NavItem } from '@/components/BottomNav'
import { type SeasonNav } from '@/components/SeasonSwitcher'
import AdminBadge from '@/components/AdminControlPanel'
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
  children,
}: {
  seasonNav: SeasonNav | null
  children: React.ReactNode
}) {
  return (
    <AppShell nav={NAV} titleExtra={<AdminBadge />} seasonNav={seasonNav}>
      {children}
    </AppShell>
  )
}
