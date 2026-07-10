import Link from 'next/link'
import {
  UsersIcon,
  CalendarIcon,
  BarChartIcon,
  PollIcon,
  BellIcon,
  ChevronRightIcon,
  PlusIcon,
  type IconProps,
} from '@/components/icons'

export type WeekDay = {
  date: number
  dow: string
  isToday: boolean
  hasEvent: boolean
}

export type NextUp = {
  kind: string
  title: string
  whenLabel: string
  place?: string | null
} | null

export type DashboardData = {
  name: string
  initials: string
  roleLabel: string
  todayLabel: string
  week: WeekDay[]
  playerCount: number
  adminCount: number
  upcoming: number
  activePolls: number
  playedGames: number
  next: NextUp
}

export default function DashboardView({
  name,
  initials,
  roleLabel,
  todayLabel,
  week,
  playerCount,
  adminCount,
  upcoming,
  activePolls,
  playedGames,
  next,
}: DashboardData) {
  return (
    <div className="px-4 pb-4">
      {/* Greeting header */}
      <header className="flex items-center justify-between pt-5">
        <div className="flex items-center gap-3">
          <div className="bg-accent flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold text-white ring-1 ring-white/10">
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
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-300 transition hover:text-white"
        >
          <BellIcon className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Title */}
      <div className="mt-6">
        <h1 className="font-display text-[2.6rem] font-extrabold leading-none tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-400">{todayLabel}</p>
      </div>

      {/* Week strip */}
      <div className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
          {week.map((d, i) => (
            <div
              key={i}
              className={`relative flex h-[68px] w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl border transition ${
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

      {/* Hero stat — active roster */}
      <div className="bg-accent relative mt-5 overflow-hidden rounded-[1.5rem] p-5">
        <div className="absolute -right-6 -top-8 opacity-15">
          <UsersIcon className="h-40 w-40" strokeWidth={1.5} />
        </div>
        <div className="relative">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
            Active roster
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-display text-6xl font-extrabold leading-none text-white">
              {playerCount}
            </span>
            <span className="mb-1 text-sm font-medium text-white/80">players</span>
          </div>
          <div className="mt-3 text-xs text-white/70">{adminCount} admins · MHL1 season</div>
        </div>
        <Link
          href="/admin/team"
          className="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white/90 transition hover:text-white"
        >
          Manage team <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Secondary stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatTile label="Upcoming" value={upcoming} sub="events" Icon={CalendarIcon} href="/admin/schedule" />
        <StatTile label="Polls" value={activePolls} sub="active" Icon={PollIcon} href="/admin/polls" />
        <StatTile label="Games" value={playedGames} sub="logged" Icon={BarChartIcon} href="/admin/stats" />
      </div>

      {/* Next up */}
      <h2 className="mt-7 text-sm font-semibold text-white">Next up</h2>
      {next ? (
        <div className="card mt-3 flex items-center gap-4 p-4">
          <div className="bg-accent/15 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-brand-light">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{next.title}</div>
            <div className="truncate text-xs text-slate-400">
              {next.kind} · {next.whenLabel}
              {next.place ? ` · ${next.place}` : ''}
            </div>
          </div>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-500" />
        </div>
      ) : (
        <Link
          href="/admin/schedule"
          className="card mt-3 flex items-center gap-4 p-4 transition hover:border-white/15"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 text-slate-400">
            <PlusIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">Nothing scheduled</div>
            <div className="text-xs text-slate-400">Add a game or training session</div>
          </div>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-500" />
        </Link>
      )}

      {/* Quick links */}
      <h2 className="mt-7 text-sm font-semibold text-white">Quick links</h2>
      <div className="mt-3 space-y-2">
        <QuickLink href="/admin/team" label="Team sheet" Icon={UsersIcon} />
        <QuickLink href="/admin/schedule" label="Schedule" Icon={CalendarIcon} />
        <QuickLink href="/admin/stats" label="Enter stats" Icon={BarChartIcon} />
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
    <Link href={href} className="card flex flex-col gap-2 p-3.5 transition hover:border-white/15">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-brand-light">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="font-display text-2xl font-bold leading-none text-white">{value}</div>
        <div className="mt-1 text-[11px] text-slate-400">
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
      className="card flex items-center gap-3 px-4 py-3.5 transition hover:border-white/15"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-brand-light">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <span className="flex-1 text-sm font-medium text-white">{label}</span>
      <ChevronRightIcon className="h-5 w-5 text-slate-500" />
    </Link>
  )
}
