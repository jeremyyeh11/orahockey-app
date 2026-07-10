import { createClient } from '@/lib/supabase/server'
import DashboardView, { type WeekDay, type NextUp } from '@/components/admin/DashboardView'

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

function whenLabel(iso: string) {
  const d = new Date(iso)
  return `${DOW[dowIndex(d)]} ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default async function AdminDashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date()
  const week = weekDays(now)
  const weekStart = week[0].toISOString()
  const weekEnd = new Date(week[6].getTime() + 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: me },
    { count: playerCount },
    { count: adminCount },
    { count: upcomingGames },
    { count: upcomingTrainings },
    { count: activePolls },
    { count: playedGames },
    { data: nextGame },
    { data: nextTraining },
    { data: weekGames },
    { data: weekTrainings },
  ] = await Promise.all([
    supabase.from('players').select('full_name, role').eq('auth_user_id', user?.id ?? '').single(),
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('games').select('*', { count: 'exact', head: true }).gte('game_date', now.toISOString()),
    supabase.from('training_sessions').select('*', { count: 'exact', head: true }).gte('session_date', now.toISOString()),
    supabase.from('polls').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('games').select('*', { count: 'exact', head: true }).not('result', 'is', null),
    supabase.from('games').select('opponent, game_date, location').gte('game_date', now.toISOString()).order('game_date').limit(1).maybeSingle(),
    supabase.from('training_sessions').select('session_date, location').gte('session_date', now.toISOString()).order('session_date').limit(1).maybeSingle(),
    supabase.from('games').select('game_date').gte('game_date', weekStart).lt('game_date', weekEnd),
    supabase.from('training_sessions').select('session_date').gte('session_date', weekStart).lt('session_date', weekEnd),
  ])

  const name = me?.full_name ?? 'Coach'

  const eventDays = new Set(
    [
      ...(weekGames ?? []).map((g) => g.game_date),
      ...(weekTrainings ?? []).map((t) => t.session_date),
    ].map((d) => new Date(d).toDateString())
  )
  const todayStr = now.toDateString()

  const weekView: WeekDay[] = week.map((d) => ({
    date: d.getDate(),
    dow: DOW[dowIndex(d)],
    isToday: d.toDateString() === todayStr,
    hasEvent: eventDays.has(d.toDateString()),
  }))

  const nextGameTime = nextGame ? new Date(nextGame.game_date).getTime() : Infinity
  const nextTrainTime = nextTraining ? new Date(nextTraining.session_date).getTime() : Infinity
  const next: NextUp =
    nextGameTime === Infinity && nextTrainTime === Infinity
      ? null
      : nextGameTime <= nextTrainTime
      ? { kind: 'Game', title: `vs ${nextGame!.opponent}`, whenLabel: whenLabel(nextGame!.game_date), place: nextGame!.location }
      : { kind: 'Training', title: 'Team training', whenLabel: whenLabel(nextTraining!.session_date), place: nextTraining!.location }

  return (
    <DashboardView
      name={name}
      initials={initials(name)}
      roleLabel={me?.role === 'admin' ? 'Coach · Admin' : 'Player'}
      todayLabel={`${DOW[dowIndex(now)]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`}
      week={weekView}
      playerCount={playerCount ?? 0}
      adminCount={adminCount ?? 0}
      upcoming={(upcomingGames ?? 0) + (upcomingTrainings ?? 0)}
      activePolls={activePolls ?? 0}
      playedGames={playedGames ?? 0}
      next={next}
    />
  )
}
