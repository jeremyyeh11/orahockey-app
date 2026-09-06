import Link from 'next/link'
import {
  UsersIcon,
  CalendarIcon,
  BarChartIcon,
  PollIcon,
  BellIcon,
  ChevronRightIcon,
  WhistleIcon,
  type IconProps,
} from '@/components/icons'

export type WeekDay = {
  date: number
  dow: string
  isToday: boolean
  hasEvent: boolean
}

export type HeroNext = {
  kind: 'match' | 'training'
  id: string
  title: string
  sub: string
  attending: number
} | null

export type SeasonRecord = {
  w: number
  d: number
  l: number
  pts: number
  played: number
} | null

export type DashboardData = {
  name: string
  initials: string
  roleLabel: string
  todayLabel: string
  week: WeekDay[]
  seasonLabel: string
  next: HeroNext
  record: SeasonRecord
  playerCount: number
  adminCount: number
  upcoming: number
  activePolls: number
  playedGames: number
}

export default function DashboardView({
  name,
  initials,
  roleLabel,
  todayLabel,
  week,
  seasonLabel,
  next,
  record,
  playerCount,
  adminCount,
  upcoming,
  activePolls,
  playedGames,
}: DashboardData) {
  return (
    <div className="liga-page liga-dashboard px-4 pb-4">
      {/* Greeting header */}
      <header className="liga-dashboard-header flex items-center justify-between pt-5">
        <div className="flex items-center gap-3">
          <div className="liga-avatar bg-accent flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold text-white ring-1 ring-white/10">
            {initials}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">{name}</div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-brand-light">
              {roleLabel}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="liga-icon-button relative flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-300 transition hover:text-white"
        >
          <BellIcon className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Title */}
      <div className="liga-page-header mt-6">
        <h1 className="liga-page-title text-white">
          Dashboard
        </h1>
        <p className="liga-meta mt-2 text-slate-400">{todayLabel}</p>
      </div>

      {/* Week strip */}
      <div className="liga-week-strip -mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
          {week.map((d, i) => (
            <div
              key={i}
              className={`liga-week-day relative flex h-[68px] w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl border transition ${
                d.isToday
                  ? 'border-transparent bg-accent'
                  : 'border-white/[0.06] bg-surface-card'
              }`}
            >
              <span className="text-lg font-bold text-white">{d.date}</span>
              <span
                className={`text-[10px] uppercase tracking-wide ${
                  d.isToday ? 'text-white/80' : 'text-slate-400'
                }`}
              >
                {d.dow}
              </span>
              {d.hasEvent && (
                <span
                  className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
                    d.isToday ? 'bg-white' : 'bg-brand-light'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hero — season + next event + record */}
      <div className="liga-hero bg-accent relative mt-5 overflow-hidden rounded-[1.5rem] p-5">
        <div className="absolute -right-6 -top-8 opacity-15">
          {next?.kind === 'training' ? (
            <WhistleIcon className="h-40 w-40" strokeWidth={1.5} />
          ) : (
            <CalendarIcon className="h-40 w-40" strokeWidth={1.5} />
          )}
        </div>

        <div className="relative">
          <div className="liga-meta text-white/70">
            {seasonLabel}
          </div>

          {next ? (
            <>
              <div className="mt-3 font-display text-2xl font-extrabold leading-tight text-white">
                {next.title}
              </div>
              <div className="liga-meta mt-1.5 text-white/80">{next.sub}</div>
              <div className="mt-3 inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                {next.attending} attending so far
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 font-display text-2xl font-extrabold leading-tight text-white">
                Season complete
              </div>
              <div className="mt-1.5 text-sm text-white/80">
                No upcoming events — add one in Schedule
              </div>
            </>
          )}

          {record && (
            <div className="liga-hero-record mt-4 border-t border-white/15 pt-3 text-xs text-white/70">
              Season: <span className="font-semibold text-white">{record.w}W</span> ·{' '}
              <span className="font-semibold text-white">{record.d}D</span> ·{' '}
              <span className="font-semibold text-white">{record.l}L</span> ·{' '}
              <span className="font-semibold text-white">{record.pts} pts</span>
              <span className="text-white/50"> · {record.played} played</span>
            </div>
          )}

          <Link
            href="/admin/schedule"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/90 transition hover:text-white"
          >
            View schedule <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="liga-stat-grid mt-4 grid grid-cols-2 gap-3">
        <StatTile label="Roster" value={playerCount} sub={`${adminCount} admins`} Icon={UsersIcon} href="/admin/team" />
        <StatTile label="Upcoming" value={upcoming} sub="events" Icon={CalendarIcon} href="/admin/schedule" />
        <StatTile label="Polls" value={activePolls} sub="active" Icon={PollIcon} href="/admin/polls" />
        <StatTile label="Games" value={playedGames} sub="logged" Icon={BarChartIcon} href="/admin/team" />
      </div>

      {/* Quick links */}
      <h2 className="liga-section-title mt-7">Quick links</h2>
      <div className="liga-list mt-3 space-y-2">
        <QuickLink href="/admin/team" label="Squad & stats" Icon={UsersIcon} />
        <QuickLink href="/admin/schedule" label="Schedule" Icon={CalendarIcon} />
        <QuickLink href="/admin/polls" label="Polls" Icon={PollIcon} />
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  Icon,
  href,
}: {
  label: string
  value: number
  sub: string
  Icon: (p: IconProps) => JSX.Element
  href: string
}) {
  return (
    <Link href={href} className="liga-stat-tile card flex flex-col gap-2 p-3.5 transition hover:border-white/15">
      <div className="liga-icon-box flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-brand-light">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="font-display text-2xl font-bold leading-none text-white">{value}</div>
        <div className="liga-meta mt-1 text-slate-400">
          {label} · {sub}
        </div>
      </div>
    </Link>
  )
}

function QuickLink({
  href,
  label,
  Icon,
}: {
  href: string
  label: string
  Icon: (p: IconProps) => JSX.Element
}) {
  return (
    <Link
      href={href}
      className="liga-link-row card flex items-center gap-3 px-4 py-3.5 transition hover:border-white/15"
    >
      <div className="liga-icon-box flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-brand-light">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <span className="flex-1 text-sm font-medium text-white">{label}</span>
      <ChevronRightIcon className="h-5 w-5 text-slate-500" />
    </Link>
  )
}
