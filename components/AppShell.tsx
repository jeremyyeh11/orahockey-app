'use client'

import { usePathname, useRouter } from 'next/navigation'
import { isLigaAppPath } from '@/lib/liga-ui'
import { signOut } from '@/lib/auth'
import { CLUB_NAME } from '@/lib/constants'
import BottomNav, { type NavItem } from '@/components/BottomNav'
import TopNav from '@/components/TopNav'
import PullToRefresh from '@/components/PullToRefresh'
import NavigationProgress from '@/components/NavigationProgress'
import { LockedSeasonStrip, SeasonMenu, SeasonTabs, type SeasonNav } from '@/components/SeasonSwitcher'

// Pages whose data isn't season-scoped don't show the season switcher
const NOT_SEASON_SCOPED = /\/(polls|profile)(\/|$)/

/**
 * Shared app chrome for the admin and player areas: sticky top bar (crest +
 * wordmark + season switcher + logout), scrollable content, and the floating
 * bottom nav. The two areas differ only in their nav items and a couple of
 * header slots:
 *  - `titleExtra`   — rendered inside the wordmark (admin control badge)
 *  - `headerActions` — rendered left of the logout button (player "Admin view")
 *
 * The season switcher is a dropdown in the header row on desktop (lg+) and a
 * row of tabs under it on touch layouts; both stay pinned with the header.
 */
export default function AppShell({
  nav,
  titleExtra,
  headerActions,
  seasonNav,
  children,
}: {
  nav: NavItem[]
  titleExtra?: React.ReactNode
  headerActions?: React.ReactNode
  seasonNav?: SeasonNav | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const ligaApp = isLigaAppPath(pathname)
  const seasons = seasonNav && seasonNav.seasons.length > 0 && !NOT_SEASON_SCOPED.test(pathname) ? seasonNav : null

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  return (
    <div className={`flex min-h-screen flex-col ${ligaApp ? 'liga-ui' : ''}`}>
      {/* Top bar — background spans the window; its contents align with the page column */}
      <header className="app-header sticky top-0 z-30 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="app-container flex items-center px-4 py-3.5 lg:py-2">
          <span className="flex items-center gap-2">
            <img src="/crest-white.png" alt={CLUB_NAME} className="h-8 w-8 object-contain" />
            <span className="app-wordmark font-display text-lg font-bold tracking-tight text-white">
              ORA <span className="text-brand-light">Hockey</span>
              {titleExtra}
            </span>
          </span>
          <TopNav items={nav} />
          <div className="ml-auto flex items-center gap-3">
            {seasons && <SeasonMenu {...seasons} />}
            {headerActions}
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-slate-400 transition hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
        {seasons && (
          <>
            <SeasonTabs {...seasons} />
            <LockedSeasonStrip {...seasons} />
          </>
        )}
      </header>

      {/* Page content — capped at the app width and padded bottom so it isn't hidden
          behind the floating nav (lg+ has no bottom nav). Pull down from the top to
          reload (the only way to refresh in the standalone PWA). */}
      <PullToRefresh className="flex-1 overflow-y-auto pb-28 lg:pb-12">
        <div className="app-container">{children}</div>
      </PullToRefresh>

      {/* Floating pill nav */}
      <BottomNav items={nav} />

      <NavigationProgress />
    </div>
  )
}
