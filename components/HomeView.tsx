import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import { dateBlock, fmtDateTime, fmtDateTimeRange, fmtRelativeDay, fmtReport, sgDayBounds } from '@/lib/format'
import { getNow } from '@/lib/preview'
import { LEAGUE, competitionLabel, gameTitle } from '@/lib/constants'
import { POST_SEASON_QUOTES, PRE_SEASON_QUOTES, pickQuote } from '@/lib/quotes'
import { getCloseSeasonSummary, getSelectedSeason, inSeason } from '@/lib/season-server'
import { countsForRecord } from '@/lib/stats'
import { PHASE_LABEL, seasonPhase, seasonTitle } from '@/lib/season'
import CloseSeasonPanel from '@/app/admin/dashboard/CloseSeasonPanel'

function firstName(full: string) {
  const f = full.split(/\s+/)[0] ?? ''
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()
}

type HomeGame = {
  id: string
  opponent: string
  game_date: string
  goals_for: number | null
  goals_against: number | null
  result: string | null
  game_type: string
  season_id: string
}

function recordOf(games: HomeGame[]) {
  return {
    w: games.filter((g) => g.result === 'win' || g.result === 'ot_win').length,
    d: games.filter((g) => g.result === 'tie').length,
    l: games.filter((g) => g.result === 'loss' || g.result === 'ot_loss').length,
  }
}

/**
 * Home dashboard — the same for players and admins (admins are players too):
 * greeting, the selected season's record, the next event (the featured card),
 * your stats this season and all time, the last result and an active-polls prompt.
 * `basePath` points its links at the caller's own section
 * (/dashboard/schedule vs /admin/schedule).
 */
export async function HomeView({ basePath }: { basePath: '/dashboard' | '/admin' }) {
  const supabase = createClient()

  const [user, season] = await Promise.all([getRequestUser(), getSelectedSeason()])

  const { data: me } = await supabase
    .from('players')
    .select('id, full_name, jersey_number, preferred_name')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const nowDate = getNow()
  const now = nowDate.toISOString()

  const [
    { data: games },
    { data: nextGame },
    { data: nextTraining },
    { data: nextEvent },
    { data: myStats },
    { data: myAtt },
    { data: mySeason },
    { count: activePolls },
  ] = await Promise.all([
    supabase
      .from('games')
      .select('id, opponent, game_date, goals_for, goals_against, result, game_type, season_id')
      .order('game_date', { ascending: false }),
    // Next event: within the season — or across every season for "All time"
    inSeason(supabase.from('games').select('id, opponent, game_date, location, ends_at, report_minutes, game_type'), season)
      .gte('game_date', now)
      .order('game_date')
      .limit(1)
      .maybeSingle(),
    inSeason(supabase.from('training_sessions').select('id, session_date, location, ends_at, report_minutes'), season)
      .gte('session_date', now)
      .order('session_date')
      .limit(1)
      .maybeSingle(),
    inSeason(supabase.from('team_events').select('id, title, event_date, location, ends_at, report_minutes'), season)
      .gte('event_date', now)
      .order('event_date')
      .limit(1)
      .maybeSingle(),
    supabase.from('player_stats').select('game_id, goals, assists').eq('player_id', me?.id ?? ''),
    supabase
      .from('attendance')
      .select('session_id, status')
      .eq('player_id', me?.id ?? '')
      .eq('session_type', 'game')
      .eq('status', 'attending'),
    // Jersey number for the season being viewed ("All time": their latest, below)
    season.allTime
      ? Promise.resolve({ data: null })
      : supabase
          .from('season_players')
          .select('jersey_number')
          .eq('season_id', season.id)
          .eq('player_id', me?.id ?? '')
          .maybeSingle(),
    supabase.from('polls').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])

  // Completed games on or before "now" — keeps date preview consistent
  const finished = ((games ?? []) as HomeGame[]).filter(
    (g) => g.result !== null && new Date(g.game_date).getTime() <= nowDate.getTime()
  )
  const inView = (g: HomeGame) => season.allTime || g.season_id === season.id
  // Records and your stats: league games only (friendlies never count)
  const playedAll = finished.filter(countsForRecord)
  const played = playedAll.filter(inView)

  // Pre-season / season / post-season, from this season's fixtures (open seasons only)
  const phase =
    season.locked || season.allTime
      ? null
      : seasonPhase(
          ((games ?? []) as HomeGame[]).filter((g) => g.season_id === season.id && countsForRecord(g)).map((g) => g.game_date),
          nowDate
        )

  // Game day / training day / event day banner on the season card (not for archived seasons)
  const today = sgDayBounds(nowDate)
  const dayLabel =
    season.locked && !season.allTime
      ? null
      : await (async () => {
          const countToday = (table: 'games' | 'training_sessions' | 'team_events', column: string) =>
            inSeason(supabase.from(table).select('*', { count: 'exact', head: true }), season)
              .gte(column, today.start)
              .lt(column, today.end)
          const [{ count: g }, { count: t }, { count: e }] = await Promise.all([
            countToday('games', 'game_date'),
            countToday('training_sessions', 'session_date'),
            countToday('team_events', 'event_date'),
          ])
          return g ? 'Game day' : t ? 'Training day' : e ? 'Event day' : null
        })()

  // Pre-season: the card shows PRE-SEASON and a line about preparing instead of 0W·0D·0L.
  // Post-season: the final record stays, with a line about wrapping up added below it.
  const preSeason = phase === 'pre-season'
  const quote = phase === 'pre-season' ? pickQuote(PRE_SEASON_QUOTES) : phase === 'post-season' ? pickQuote(POST_SEASON_QUOTES) : null

  // Admin Danger zone: closing the current season (admin Home, viewing that season)
  const closeSummary =
    basePath === '/admin' && season.is_current && !season.locked ? await getCloseSeasonSummary(season) : null

  const record = recordOf(played)
  const goalsFor = played.reduce((s, g) => s + (g.goals_for ?? 0), 0)
  const goalsAgainst = played.reduce((s, g) => s + (g.goals_against ?? 0), 0)

  /** Your goals / assists / games attended across a set of played games */
  function myTotals(gamesPlayed: HomeGame[]) {
    const ids = new Set(gamesPlayed.map((g) => g.id))
    const rows = (myStats ?? []).filter((r) => ids.has(r.game_id))
    return {
      goals: rows.reduce((s, r) => s + r.goals, 0),
      assists: rows.reduce((s, r) => s + r.assists, 0),
      apps: (myAtt ?? []).filter((a) => ids.has(a.session_id)).length,
    }
  }
  const mine = myTotals(played)
  const attendancePct = played.length > 0 ? Math.round((mine.apps / played.length) * 100) : 0
  const allTime = myTotals(playedAll)
  const allTimeRecord = recordOf(playedAll)
  const jersey = mySeason?.jersey_number ?? me?.jersey_number ?? null

  // The most recent result shown on Home can be a friendly (it's just not counted)
  const lastGame = finished.filter(inView)[0]

  // Soonest of the next game, training and team event. `key` matches the schedule's
  // event keys (lib/useEventSelection) so "Open details" can open that event.
  const next =
    [
      nextGame && { key: `game-${nextGame.id}`, title: gameTitle(nextGame.opponent), tag: competitionLabel(nextGame.game_type), when: nextGame.game_date, ends: nextGame.ends_at, report: nextGame.report_minutes, place: nextGame.location },
      nextTraining && { key: `training-${nextTraining.id}`, title: 'Team training', tag: null, when: nextTraining.session_date, ends: nextTraining.ends_at, report: nextTraining.report_minutes, place: nextTraining.location },
      nextEvent && { key: `event-${nextEvent.id}`, title: nextEvent.title, tag: null, when: nextEvent.event_date, ends: nextEvent.ends_at, report: nextEvent.report_minutes, place: nextEvent.location },
    ]
      .filter((x): x is NextItem & { key: string } => !!x)
      .sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())[0] ?? null

  // Next up / season complete — the featured card straight under the season record
  const nextUpTitle = season.locked && !season.allTime ? 'Season' : 'Next up'
  const nextUpCard =
    season.locked && !season.allTime ? (
      <NextUpNote title="Season finished">
        {LEAGUE} {season.label} is a past season. Switch season to see what&apos;s next.
      </NextUpNote>
    ) : next ? (
      <NextUpCard next={next} href={`${basePath}/schedule?event=${next.key}`} now={nowDate} />
    ) : played.length > 0 ? (
      <NextUpNote title="Season complete">Nothing scheduled — enjoy the off-season.</NextUpNote>
    ) : (
      <NextUpNote title="Nothing scheduled yet">
        {season.allTime ? 'Upcoming' : seasonTitle(season)} fixtures and trainings will show here.
      </NextUpNote>
    )

  // Your numbers — under Next up on phones, the right-hand column on desktop
  const yourStats = (
    <>
      <h2 className="liga-section-title mt-6 lg:mt-0">{season.allTime ? 'Your all-time stats' : `Your ${season.label} season`}</h2>
      <div className="liga-stat-grid mt-2 grid grid-cols-3 gap-3">
        <Tile value={mine.goals} label="Goals" />
        <Tile value={mine.assists} label="Assists" />
        <Tile value={`${attendancePct}%`} label="Attendance" />
      </div>

      {/* All time — below the season, always open. Not shown when "All time" itself
          is selected (the stats above are already that). */}
      {!season.allTime && (
        <div className="liga-all-time mt-6">
          <h2 className="liga-section-title">All time</h2>
          <AllTime totals={allTime} record={allTimeRecord} games={playedAll.length} />
        </div>
      )}
    </>
  )

  const RESULT_LABEL: Record<string, string> = { win: 'Win', loss: 'Loss', tie: 'Draw', ot_win: 'OT Win', ot_loss: 'OT Loss' }

  return (
    <div className="liga-page liga-home p-4">
      {/* Greeting */}
      <div className="liga-page-header mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="liga-section-title">Home</div>
          <h1 className="liga-page-title mt-1 text-white">
            {me ? `Hi, ${me.preferred_name?.trim() || firstName(me.full_name)}` : 'Home'}
          </h1>
        </div>
        {jersey != null && <span className="liga-meta shrink-0 pb-1 text-slate-500">#{jersey}</span>}
      </div>

      {/* Desktop (lg+): season record, next up and recent activity on the left, your stats on the right */}
      <div className="liga-home-layout lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {/* Season record hero */}
          <div className="liga-hero bg-accent relative overflow-hidden rounded-[1.5rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="liga-meta text-white/70">
                {season.allTime ? `All time · ${LEAGUE}` : `Season ${season.label} · ${LEAGUE}`}
                {season.locked && !season.allTime ? ' · Final' : ''}
                {phase && !preSeason ? ` · ${PHASE_LABEL[phase]}` : ''}
              </div>
              {dayLabel && (
                <span className="liga-day-label shrink-0 rounded bg-white/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  {dayLabel}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="font-display text-4xl font-extrabold leading-none text-white">
                {preSeason ? PHASE_LABEL['pre-season'].toUpperCase() : `${record.w}W · ${record.d}D · ${record.l}L`}
              </span>
            </div>
            <div className="liga-hero-sub mt-2 text-xs text-white/70">
              {preSeason ? quote : `${gamesLabel(played.length)} · ${goalsFor} scored · ${goalsAgainst} conceded`}
            </div>
            {phase === 'post-season' && (
              <div className="liga-hero-quote mt-3 border-t border-white/15 pt-3 text-sm text-white/90">{quote}</div>
            )}
          </div>

          {/* Next up — the featured card, straight under the season record */}
          <h2 className="liga-section-title mt-6">{nextUpTitle}</h2>
          {nextUpCard}

          {/* Your stats — phones: under Next up (desktop: right column) */}
          <div className="lg:hidden">{yourStats}</div>

          {/* Last result */}
          {lastGame && (
            <>
              <h2 className="liga-section-title mt-6">Last game</h2>
              <Link href={`${basePath}/schedule?event=game-${lastGame.id}`} className="liga-link-row card mt-2 flex items-center gap-4 p-4 transition hover:border-white/15">
                <div
                  className={`liga-result-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    lastGame.result === 'win' || lastGame.result === 'ot_win'
                      ? 'bg-green-900/50 text-green-300'
                      : lastGame.result === 'tie'
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-red-900/50 text-red-300'
                  }`}
                >
                  {lastGame.goals_for}–{lastGame.goals_against}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="liga-link-title break-words text-sm font-semibold text-white">{gameTitle(lastGame.opponent)}</div>
                    <CompetitionTag label={competitionLabel(lastGame.game_type)} />
                  </div>
                  <div className="liga-meta mt-0.5 text-slate-400">
                    {RESULT_LABEL[lastGame.result ?? ''] ?? ''} · {fmtDateTime(lastGame.game_date)}
                  </div>
                </div>
              </Link>
            </>
          )}

          {/* Active polls prompt */}
          {(activePolls ?? 0) > 0 && (
            <Link
              href={`${basePath}/polls`}
              className="liga-link-row card mt-6 flex items-center justify-between p-4 transition hover:border-white/15"
            >
              <div>
                <div className="liga-link-title text-sm font-semibold text-white">
                  {activePolls} active poll{activePolls === 1 ? '' : 's'}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">Your vote is needed</div>
              </div>
              <span className="text-brand-light">→</span>
            </Link>
          )}
        </div>

        {/* Your stats — desktop: the right column, beside the season record */}
        <div className="hidden min-w-0 lg:block">{yourStats}</div>
      </div>

      {/* Admins only: close the current season (multi-step confirmation) */}
      {closeSummary && <CloseSeasonPanel summary={closeSummary} />}
    </div>
  )
}

/** "1 game" / "14 games" */
function gamesLabel(n: number) {
  return `${n} game${n === 1 ? '' : 's'}`
}

/** "MHL1" or "Friendly" beside a game's title */
function CompetitionTag({ label }: { label: string }) {
  const friendly = label === 'Friendly'
  return (
    <span
      className={`liga-competition-tag shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        friendly ? 'bg-amber-900/50 text-amber-300' : 'bg-white/10 text-slate-300'
      }`}
    >
      {label}
    </span>
  )
}

type NextItem = { title: string; tag: string | null; when: string; ends: string | null; report: number | null; place: string | null }

/**
 * The next event, featured: a big date block, title, time and place, and an
 * "Open details" call to action into the schedule (the details panel on desktop,
 * the event modal on phones).
 */
function NextUpCard({ next, href, now }: { next: NextItem; href: string; now: Date }) {
  const day = dateBlock(next.when)
  const report = fmtReport(next.when, next.report)
  return (
    <Link href={href} className="liga-next-card card mt-2 block p-4 transition hover:border-white/15 lg:p-5">
      <div className="flex items-start gap-4">
        <div className="liga-next-date flex w-14 shrink-0 flex-col items-center border-r border-white/10 pr-4">
          <span className="liga-next-date-day text-3xl font-bold leading-none text-white">{day.day}</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{day.mon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="liga-meta font-semibold uppercase text-brand-light">{fmtRelativeDay(next.when, now)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="liga-next-title break-words text-xl font-semibold leading-tight text-white lg:text-2xl">{next.title}</div>
            {next.tag && <CompetitionTag label={next.tag} />}
          </div>
          <div className="liga-meta mt-2 text-slate-300">{fmtDateTimeRange(next.when, next.ends)}</div>
          {next.place && <div className="liga-meta break-words text-slate-400">{next.place}</div>}
          {report && <div className="liga-meta text-slate-500">{report}</div>}
        </div>
      </div>
      <div className="mt-4 flex">
        <span className="liga-button liga-button-primary bg-accent w-full rounded-lg px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 lg:ml-auto lg:w-auto">
          Open details<span aria-hidden="true">&nbsp;→</span>
        </span>
      </div>
    </Link>
  )
}

/** Next up's empty states (season finished, nothing scheduled) */
function NextUpNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="liga-next-card card mt-2 p-4 lg:p-5">
      <div className="text-base font-semibold text-white">{title}</div>
      <div className="liga-meta mt-1 text-slate-400">{children}</div>
    </div>
  )
}

/** All-time numbers — quieter than the season tiles so the season leads. */
function AllTime({
  totals,
  record,
  games,
}: {
  totals: { goals: number; assists: number; apps: number }
  record: { w: number; d: number; l: number }
  games: number
}) {
  return (
    <div className="card mt-2 p-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <MiniStat value={totals.apps} label="Apps" />
        <MiniStat value={totals.goals} label="Goals" />
        <MiniStat value={totals.assists} label="Assists" />
      </div>
      <div className="liga-meta mt-3 border-t border-white/10 pt-3 text-center text-slate-400">
        Team · {gamesLabel(games)} · {record.w}W · {record.d}D · {record.l}L
      </div>
    </div>
  )
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-lg font-semibold leading-none text-slate-200">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="liga-stat-tile card flex flex-col items-center gap-1 p-3.5">
      <div className="font-display text-2xl font-bold leading-none text-white">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  )
}
