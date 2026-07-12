import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/format'

export default async function PlayerStatsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: me }, { data: players }, { data: stats, error }, { data: games }, { data: att }] =
    await Promise.all([
      supabase.from('players').select('id, full_name, jersey_number').eq('auth_user_id', user?.id ?? '').single(),
      supabase.from('players').select('id, full_name, jersey_number').eq('is_active', true),
      supabase
        .from('player_stats')
        .select('player_id, game_id, goals, goals_fg, goals_pc, goals_ps, assists, clean_sheet'),
      supabase
        .from('games')
        .select('id, opponent, game_date, goals_for, goals_against, result')
        .order('game_date', { ascending: false }),
      supabase
        .from('attendance')
        .select('player_id, session_id')
        .eq('session_type', 'game')
        .eq('status', 'attending'),
    ])

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Error loading stats: {error.message}</p>
      </div>
    )
  }

  // Caps = games played (from attendance on played games — placeholder
  // numbers until real attendance is tracked)
  const playedIds = new Set((games ?? []).filter((g) => g.result).map((g) => g.id))
  const caps: Record<string, number> = {}
  for (const a of att ?? []) {
    if (playedIds.has(a.session_id)) caps[a.player_id] = (caps[a.player_id] ?? 0) + 1
  }

  // Season totals per player
  const totals: Record<
    string,
    { fg: number; pc: number; ps: number; goals: number; assists: number; cleanSheets: number }
  > = {}
  for (const s of stats ?? []) {
    const t = (totals[s.player_id] ??= { fg: 0, pc: 0, ps: 0, goals: 0, assists: 0, cleanSheets: 0 })
    t.fg += s.goals_fg
    t.pc += s.goals_pc
    t.ps += s.goals_ps
    t.goals += s.goals
    t.assists += s.assists
    if (s.clean_sheet) t.cleanSheets += 1
  }

  const leaderboard = (players ?? [])
    .map((p) => ({
      player: p,
      caps: caps[p.id] ?? 0,
      ...(totals[p.id] ?? { fg: 0, pc: 0, ps: 0, goals: 0, assists: 0, cleanSheets: 0 }),
    }))
    .filter((r) => r.goals > 0 || r.assists > 0 || r.cleanSheets > 0 || r.caps > 0)
    .sort(
      (a, b) =>
        b.goals - a.goals || b.assists - a.assists || b.cleanSheets - a.cleanSheets || b.caps - a.caps
    )

  const mine = me
    ? totals[me.id] ?? { fg: 0, pc: 0, ps: 0, goals: 0, assists: 0, cleanSheets: 0 }
    : null
  const myCaps = me ? caps[me.id] ?? 0 : 0
  const myGameStats = me
    ? (stats ?? [])
        .filter((s) => s.player_id === me.id && (s.goals > 0 || s.assists > 0 || s.clean_sheet))
        .map((s) => ({ stat: s, game: (games ?? []).find((g) => g.id === s.game_id) }))
        .filter((x) => x.game)
        .sort((a, b) => new Date(b.game!.game_date).getTime() - new Date(a.game!.game_date).getTime())
    : []

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-white">Stats</h1>

      {/* My season */}
      {mine && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">My season</h2>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="card flex flex-col items-center gap-1 p-3.5">
              <div className="font-display text-2xl font-bold leading-none text-white">{mine.goals}</div>
              <div className="text-[11px] text-slate-400">Goals</div>
            </div>
            <div className="card flex flex-col items-center gap-1 p-3.5">
              <div className="font-display text-2xl font-bold leading-none text-white">{mine.assists}</div>
              <div className="text-[11px] text-slate-400">Assists</div>
            </div>
            <div className="card flex flex-col items-center gap-1 p-3.5">
              <div className="font-display text-2xl font-bold leading-none text-white">{myCaps}</div>
              <div className="text-[11px] text-slate-400">Caps</div>
            </div>
          </div>
        </>
      )}

      {/* My contributions per game */}
      {myGameStats.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">My games</h2>
          <div className="card mb-6 divide-y divide-white/5">
            {myGameStats.map(({ stat, game }) => (
              <div key={stat.game_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">vs {game!.opponent}</div>
                  <div className="text-xs text-slate-500">{fmtDate(game!.game_date)}</div>
                </div>
                <div className="shrink-0 text-xs text-slate-300">
                  {stat.goals_fg > 0 && <span className="mr-2">FG {stat.goals_fg}</span>}
                  {stat.goals_pc > 0 && <span className="mr-2">PC {stat.goals_pc}</span>}
                  {stat.goals_ps > 0 && <span className="mr-2">PS {stat.goals_ps}</span>}
                  {stat.assists > 0 && <span className="mr-2">A {stat.assists}</span>}
                  {stat.clean_sheet && <span className="text-green-400">CS</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Team leaderboard */}
      <h2 className="mb-2 text-sm font-semibold text-white">Team leaderboard</h2>
      <div className="card overflow-hidden">
        {leaderboard.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No stats recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
                <th className="px-2 py-2.5 font-medium">Player</th>
                <th className="px-2 py-2.5 text-center font-medium">G</th>
                <th className="px-2 py-2.5 text-center font-medium">A</th>
                <th className="px-2 py-2.5 text-center font-medium">CS</th>
                <th className="py-2.5 pl-2 pr-4 text-center font-medium">Caps</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr
                  key={row.player.id}
                  className={`border-b border-white/5 last:border-0 ${
                    me && row.player.id === me.id ? 'bg-brand/10' : ''
                  }`}
                >
                  <td className="py-2.5 pl-4 pr-2 text-slate-500">{i + 1}</td>
                  <td className="max-w-0 truncate px-2 py-2.5">
                    <div className="truncate font-medium text-white">{row.player.full_name}</div>
                    {row.goals > 0 && (
                      <div className="text-[10px] text-slate-500">
                        {[
                          row.fg > 0 ? `FG ${row.fg}` : null,
                          row.pc > 0 ? `PC ${row.pc}` : null,
                          row.ps > 0 ? `PS ${row.ps}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center font-semibold text-white">
                    {row.goals > 0 ? row.goals : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-300">
                    {row.assists > 0 ? row.assists : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-300">
                    {row.cleanSheets > 0 ? row.cleanSheets : '—'}
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-center text-slate-300">{row.caps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
