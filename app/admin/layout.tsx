'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'
import { CLUB_NAME } from '@/lib/constants'
import BottomNav, { type NavItem } from '@/components/BottomNav'
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
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-xl">
        <span className="flex items-center gap-2">
          <img src="/crest-white.png" alt={CLUB_NAME} className="h-8 w-8 object-contain" />
          <span className="font-display text-lg font-bold tracking-tight text-white">
            ORA <span className="text-brand-light">Hockey</span>
            <AdminBadge />
          </span>
        </span>
        <button
          onClick={handleLogout}
          className="text-xs font-medium text-slate-400 transition hover:text-white"
        >
          Logout
        </button>
      </header>

      {/* Page content — padded bottom so it isn't hidden behind the floating nav */}
      <main className="flex-1 overflow-y-auto pb-28">{children}</main>

      {/* Floating center menu */}
      <BottomNav items={NAV} />
    </div>
  )
}
