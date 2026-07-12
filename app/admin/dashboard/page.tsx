import { createClient } from '@/lib/supabase/server'
import DashboardView, { type WeekDay, type HeroNext } from '@/components/admin/DashboardView'
import { fmtDateTime } from '@/lib/format'
import { getNow } from '@/lib/preview'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const dowIndex = (d: Date) => (d.getDay() + 6) % 7 // 0 = Monday

/** Mon–Sun of the week containing `ref`. */
function weekDays(ref: Date) {
  const monday = new Date(ref)
  monday.setDate(ref.getDate() - dowIndex(ref))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default async function AdminDashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = getNow()
  const week = weekDays(now)
  const weekStart = week[0].toISOString()
  const weekEnd = new Date(week[6].getTime() + 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: me },
    { data: team },
    { count: playerCount },
    { count: adminCount },
    { count: activePolls },
    { data: allGames },
    { data: allTrainings },
  ] = await Promise.all([
    supabase.from('players').select('full_name, role').eq('auth_user_id', user?.id ?? '').single(),
    supabase.from('teams').select('league, season').limit(1).maybeSingle(),
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('polls').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('games').select('id, opponent, game_date, location, result').order('game_date'),
    supabase.from('training_sessions').select('id, session_date, location').order('session_date'),
  ])

  const name = me?.full_name ?? 'Coach'
  const games = allGames ?? []
  const trainings = allTrainings ?? []

  // Derived from the two base lists instead of separate count queries
  const nowMs = now.getTime()
  const upcomingGames = games.filter((g) => new Date(g.game_date).getTime() >= nowMs).length
  const futureTrainings = trainings.filter((t) => new Date(t.session_date).getTime() >= nowMs)
  const upcomingTrainings = futureTrainings.length
  const nextTraining = futureTrainings[0] ?? null
  const weekTrainings = trainings.filter((t) => {
    const time = new Date(t.session_date).getTime()
    return time >= new Date(weekStart).getTime() && time < new Date(weekEnd).getTime()
  })

  // Season label comes from the teams table — edit league/season there to change it
  const seasonLabel = team ? `${team.league} · ${team.season}` : 'Season'

  // Record + league points (3 for a win, 1 for a draw).
  // Only count games on or before "now" so date preview shows the season as of that day.
  const played = games.filter((g) => g.result && new Date(g.game_date).getTime() <= now.getTime())
  const w = played.filter((g) => g.result === 'win' || g.result === 'ot_win').length
  const d = played.filter((g) => g.result === 'tie').length
  const l = played.filter((g) => g.result === 'loss' || g.result === 'ot_loss').length
  const record = played.length > 0 ? { w, d, l, pts: w * 3 + d, played: played.length } : null

  // Next event: earliest upcoming game or training
  const nextGame = games.find((g) => new Date(g.game_date).getTime() >= now.getTime()) ?? null
  const nextGameTime = nextGame ? new Date(nextGame.game_date).getTime() : Infinity
  const nextTrainTime = nextTraining ? new Date(nextTraining.session_date).getTime() : Infinity

  let next: HeroNext = null
  if (nextGameTime !== Infinity || nextTrainTime !== Infinity) {
    if (nextGameTime <= nextTrainTime) {
      const matchNo = games.filter((g) => new Date(g.game_date).getTime() < nextGameTime).length + 1
      next = {
        kind: 'match',
        id: nextGame!.id,
        title: `Match #${matchNo} · ORA vs ${nextGame!.opponent}`,
        sub: `${fmtDateTime(nextGame!.game_date)}${nextGame!.location ? ` · ${nextGame!.location}` : ''}`,
        attending: 0,
      }
    } else {
      next = {
        kind: 'training',
        id: nextTraining!.id,
        title: 'Training',
        sub: `${fmtDateTime(nextTraining!.session_date)}${nextTraining!.location ? ` · ${nextTraining!.location}` : ''}`,
        attending: 0,
      }
    }

    const { count: attending } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', next.id)
      .eq('status', 'attending')
    next.attending = attending ?? 0
  }

  const weekStartMs = new Date(weekStart).getTime()
  const weekEndMs = new Date(weekEnd).getTime()
  const eventDays = new Set(
    [
      ...games
        .filter((g) => {
          const t = new Date(g.game_date).getTime()
          return t >= weekStartMs && t < weekEndMs
        })
        .map((g) => g.game_date),
      ...(weekTrainings ?? []).map((t) => t.session_date),
    ].map((iso) => new Date(iso).toDateString())
  )
  const todayStr = now.toDateString()

  const weekView: WeekDay[] = week.map((day) => ({
    date: day.getDate(),
    dow: DOW[dowIndex(day)],
    isToday: day.toDateString() === todayStr,
    hasEvent: eventDays.has(day.toDateString()),
  }))

  return (
    <DashboardView
      name={name}
      initials={initials(name)}
      roleLabel={me?.role === 'admin' ? 'Admin' : 'Player'}
      todayLabel={`${DOW[dowIndex(now)]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`}
      week={weekView}
      seasonLabel={seasonLabel}
      next={next}
      record={record}
      playerCount={playerCount ?? 0}
      adminCount={adminCount ?? 0}
      upcoming={(upcomingGames ?? 0) + (upcomingTrainings ?? 0)}
      activePolls={activePolls ?? 0}
      playedGames={played.length}
    />
  )
}
