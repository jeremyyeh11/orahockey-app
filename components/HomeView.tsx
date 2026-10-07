import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import { fmtDateTime } from '@/lib/format'
import { getNow } from '@/lib/preview'
import { LEAGUE } from '@/lib/constants'
import { getSelectedSeason, inSeason } from '@/lib/season-server'
import { seasonTitle } from '@/lib/season'

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
 * greeting, the selected season's record and your stats in it, then your
 * all-time stats, next event, last result and an active-polls prompt.
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
    inSeason(supabase.from('games').select('opponent, game_date, location'), season)
      .gte('game_date', now)
      .order('game_date')
      .limit(1)
      .maybeSingle(),
    inSeason(supabase.from('training_sessions').select('session_date, location'), season)
      .gte('session_date', now)
      .order('session_date')
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
  const playedAll = ((games ?? []) as HomeGame[]).filter(
    (g) => g.result !== null && new Date(g.game_date).getTime() <= nowDate.getTime()
  )
  const played = season.allTime ? playedAll : playedAll.filter((g) => g.season_id === season.id)

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

  const lastGame = played[0]

  const nextGameTime = nextGame ? new Date(nextGame.game_date).getTime() : Infinity
  const nextTrainTime = nextTraining ? new Date(nextTraining.session_date).getTime() : Infinity
  const next =
    nextGameTime === Infinity && nextTrainTime === Infinity
      ? null
      : nextGameTime <= nextTrainTime
      ? { kind: 'Game', title: `vs ${nextGame!.opponent}`, when: nextGame!.game_date, place: nextGame!.location }
      : { kind: 'Training', title: 'Team training', when: nextTraining!.session_date, place: nextTraining!.location }

  // Next up / season complete — shown under the hero on phones, top right on desktop
  const nextUpTitle = season.locked && !season.allTime ? 'Season' : 'Next up'
  const nextUpCard =
    season.locked && !season.allTime ? (
      <div className="liga-link-row card mt-2 p-4">
        <div className="liga-link-title text-sm font-semibold text-white">Season finished</div>
        <div className="liga-meta mt-0.5 text-slate-400">
          {LEAGUE} {season.label} is a past season. Switch season to see what&apos;s next.
        </div>
      </div>
    ) : next ? (
      <Link href={`${basePath}/schedule`} className="liga-link-row card mt-2 block p-4 transition hover:border-white/15">
        <div className="liga-link-title text-sm font-semibold text-white">{next.title}</div>
        <div className="liga-meta mt-0.5 text-slate-400">
          {next.kind} · {fmtDateTime(next.when)}
          {next.place ? ` · ${next.place}` : ''}
        </div>
      </Link>
    ) : played.length > 0 ? (
      <div className="liga-link-row card mt-2 p-4">
        <div className="liga-link-title text-sm font-semibold text-white">Season complete</div>
        <div className="liga-meta mt-0.5 text-slate-400">Nothing scheduled — enjoy the off-season.</div>
      </div>
    ) : (
      <div className="liga-link-row card mt-2 p-4">
        <div className="liga-link-title text-sm font-semibold text-white">Nothing scheduled yet</div>
        <div className="liga-meta mt-0.5 text-slate-400">
          {season.allTime ? 'Upcoming' : seasonTitle(season)} fixtures and trainings will show here.
        </div>
      </div>
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

      {/* Desktop (lg+): season + your stats + all time on the left, what's next / last / polls on the right */}
      <div className="liga-home-layout lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {/* Season record hero */}
          <div className="liga-hero bg-accent relative overflow-hidden rounded-[1.5rem] p-5">
            <div className="liga-meta text-white/70">
              {season.allTime ? `All time · ${LEAGUE}` : `Season ${season.label} · ${LEAGUE}`}
              {season.locked && !season.allTime ? ' · Final' : ''}
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="font-display text-4xl font-extrabold leading-none text-white">
                {record.w}W · {record.d}D · {record.l}L
              </span>
            </div>
            <div className="mt-2 text-xs text-white/70">
              {played.length} games · {goalsFor} scored · {goalsAgainst} conceded
            </div>
          </div>

          {/* Next up — phones: straight under the season record */}
          <div className="lg:hidden">
            <h2 className="liga-section-title mt-6">{nextUpTitle}</h2>
            {nextUpCard}
          </div>

          {/* My stats tiles — this season */}
          <h2 className="liga-section-title mt-6">{season.allTime ? 'Your all-time stats' : `Your ${season.label} season`}</h2>
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
        </div>

        <div className="min-w-0">
          {/* Next up — desktop: top of the right column, beside the season record */}
          <div className="hidden lg:block">
            <h2 className="liga-section-title">{nextUpTitle}</h2>
            {nextUpCard}
          </div>

          {/* Last result */}
          {lastGame && (
            <>
              <h2 className="liga-section-title mt-6">Last game</h2>
              <Link href={`${basePath}/schedule`} className="liga-link-row card mt-2 flex items-center gap-4 p-4 transition hover:border-white/15">
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
                  <div className="liga-link-title break-words text-sm font-semibold text-white">vs {lastGame.opponent}</div>
                  <div className="liga-meta mt-0.5 text-slate-400">
                    {RESULT_LABEL[lastGame.result ?? ''] ?? ''}
                    {lastGame.game_type !== 'regular' ? ` · ${lastGame.game_type}` : ''} ·{' '}
                    {fmtDateTime(lastGame.game_date)}
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
      </div>
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
        Team · {games} games · {record.w}W · {record.d}D · {record.l}L
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
