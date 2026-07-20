'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'
import { CLUB_NAME } from '@/lib/constants'
import BottomNav, { type NavItem } from '@/components/BottomNav'
import PullToRefresh from '@/components/PullToRefresh'

/**
 * Shared app chrome for the admin and player areas: sticky top bar (crest +
 * wordmark + logout), scrollable content, and the floating bottom nav. The two
 * areas differ only in their nav items and a couple of header slots:
 *  - `titleExtra`   — rendered inside the wordmark (admin control badge)
 *  - `headerActions` — rendered left of the logout button (player "Admin view")
 */
export default function AppShell({
  nav,
  titleExtra,
  headerActions,
  children,
}: {
  nav: NavItem[]
  titleExtra?: React.ReactNode
  headerActions?: React.ReactNode
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
            {titleExtra}
          </span>
        </span>
        <div className="flex items-center gap-3">
          {headerActions}
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-slate-400 transition hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Page content — padded bottom so it isn't hidden behind the floating nav.
          Pull down from the top to reload (the only way to refresh in the standalone PWA). */}
      <PullToRefresh className="relative flex-1 overflow-y-auto pb-28">{children}</PullToRefresh>

      {/* Floating pill nav */}
      <BottomNav items={nav} />
    </div>
  )
}
