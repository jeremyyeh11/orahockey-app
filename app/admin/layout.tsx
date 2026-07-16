'use client'

import AppShell from '@/components/AppShell'
import { type NavItem } from '@/components/BottomNav'
import AdminBadge from '@/components/AdminControlPanel'
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  PollIcon,
  UserIcon,
} from '@/components/icons'

const NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', Icon: HomeIcon, exact: true },
  { href: '/admin/team', label: 'Squad', Icon: UsersIcon },
  { href: '/admin/schedule', label: 'Schedule', Icon: CalendarIcon },
  { href: '/admin/polls', label: 'Polls', Icon: PollIcon },
  { href: '/admin/profile', label: 'Profile', Icon: UserIcon },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell nav={NAV} titleExtra={<AdminBadge />}>
      {children}
    </AppShell>
  )
}
