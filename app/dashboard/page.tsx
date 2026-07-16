import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fmtDateTime } from '@/lib/format'
import { getNow } from '@/lib/preview'
import { LEAGUE } from '@/lib/constants'

function firstName(full: string) {
  const f = full.split(/\s+/)[0] ?? ''
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()
}

export default async function PlayerDashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('players')
    .select('id, full_name, jersey_number, preferred_name')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const nowDate = getNow()
  const now = nowDate.toISOString()

  const [{ data: games }, { data: nextGame }, { data: nextTraining }, { data: myStats }, { data: myAtt }, { count: activePolls }] =
    await Promise.all([
      supabase
        .from('games')
        .select('id, opponent, game_date, goals_for, goals_against, result, game_type')
        .not('result', 'is', null)
        .order('game_date', { ascending: false }),
      supabase.from('games').select('opponent, game_date, location').gte('game_date', now).order('game_date').limit(1).maybeSingle(),
      supabase.from('training_sessions').select('session_date, location').gte('session_date', now).order('session_date').limit(1).maybeSingle(),
      supabase.from('player_stats').select('game_id, goals, assists').eq('player_id', me?.id ?? ''),
      supabase
        .from('attendance')
        .select('session_id, status')
        .eq('player_id', me?.id ?? '')
        .eq('session_type', 'game')
        .eq('status', 'attending'),
    supabase.from('polls').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ])

  // Only games on or before "now" — keeps date preview consistent
  const played = (games ?? []).filter((g) => new Date(g.game_date).getTime() <= nowDate.getTime())
  const record = {
    w: played.filter((g) => g.result === 'win' || g.result === 'ot_win').length,
    d: played.filter((g) => g.result === 'tie').length,
    l: played.filter((g) => g.result === 'loss' || g.result === 'ot_loss').length,
  }
  const goalsFor = played.reduce((s, g) => s + (g.goals_for ?? 0), 0)
  const goalsAgainst = played.reduce((s, g) => s + (g.goals_against ?? 0), 0)

  const playedIds = new Set(played.map((g) => g.id))
  const myPlayedStats = (myStats ?? []).filter((r) => playedIds.has(r.game_id))
  const myGoals = myPlayedStats.reduce((s, r) => s + r.goals, 0)
  const myAssists = myPlayedStats.reduce((s, r) => s + r.assists, 0)
  const attendedGames = (myAtt ?? []).filter((a) => playedIds.has(a.session_id)).length
  const attendancePct = played.length > 0 ? Math.round((attendedGames / played.length) * 100) : 0

  const lastGame = played[0]

  const nextGameTime = nextGame ? new Date(nextGame.game_date).getTime() : Infinity
  const nextTrainTime = nextTraining ? new Date(nextTraining.session_date).getTime() : Infinity
  const next =
    nextGameTime === Infinity && nextTrainTime === Infinity
      ? null
      : nextGameTime <= nextTrainTime
      ? { kind: 'Game', title: `vs ${nextGame!.opponent}`, when: nextGame!.game_date, place: nextGame!.location }
      : { kind: 'Training', title: 'Team training', when: nextTraining!.session_date, place: nextTraining!.location }

  const RESULT_LABEL: Record<string, string> = { win: 'Win', loss: 'Loss', tie: 'Draw', ot_win: 'OT Win', ot_loss: 'OT Loss' }

  return (
    <div className="p-4">
      {/* Greeting */}
      <h1 className="text-xl font-bold text-white">
        {me ? `Hi, ${me.preferred_name?.trim() || firstName(me.full_name)}` : 'Home'}
        {me?.jersey_number != null && <span className="ml-2 text-slate-500">#{me.jersey_number}</span>}
      </h1>

      {/* Season record hero */}
      <div className="bg-accent relative mt-4 overflow-hidden rounded-[1.5rem] p-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
          Season {nowDate.getFullYear()} · {LEAGUE}
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

      {/* My stats tiles */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile value={myGoals} label="Goals" />
        <Tile value={myAssists} label="Assists" />
        <Tile value={`${attendancePct}%`} label="Attendance" />
      </div>

      {/* Next up / season complete */}
      <h2 className="mt-6 text-sm font-semibold text-white">Next up</h2>
      {next ? (
        <Link href="/dashboard/schedule" className="card mt-2 block p-4 transition hover:border-white/15">
          <div className="text-sm font-semibold text-white">{next.title}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {next.kind} · {fmtDateTime(next.when)}
            {next.place ? ` · ${next.place}` : ''}
          </div>
        </Link>
      ) : (
        <div className="card mt-2 p-4">
          <div className="text-sm font-semibold text-white">Season complete</div>
          <div className="mt-0.5 text-xs text-slate-400">Nothing scheduled — enjoy the off-season.</div>
        </div>
      )}

      {/* Last result */}
      {lastGame && (
        <>
          <h2 className="mt-6 text-sm font-semibold text-white">Last game</h2>
          <Link href="/dashboard/schedule" className="card mt-2 flex items-center gap-4 p-4 transition hover:border-white/15">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
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
              <div className="truncate text-sm font-semibold text-white">vs {lastGame.opponent}</div>
              <div className="mt-0.5 text-xs text-slate-400">
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
          href="/dashboard/polls"
          className="card mt-6 flex items-center justify-between p-4 transition hover:border-white/15"
        >
          <div>
            <div className="text-sm font-semibold text-white">
              {activePolls} active poll{activePolls === 1 ? '' : 's'}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">Your vote is needed</div>
          </div>
          <span className="text-brand-light">→</span>
        </Link>
      )}
    </div>
  )
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-3.5">
      <div className="font-display text-2xl font-bold leading-none text-white">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  )
}
