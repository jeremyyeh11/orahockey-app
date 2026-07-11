'use client'

import { useMemo, useState, useTransition } from 'react'
import { saveGameStats, type StatRow } from './actions'
import { fmtDate } from '@/lib/format'

export type Player = {
  id: string
  full_name: string
  jersey_number: number | null
  position: string[] | null
}

export type Game = {
  id: string
  opponent: string
  game_date: string
  goals_for: number | null
  goals_against: number | null
  result: string | null
}

export type Stat = {
  player_id: string
  game_id: string
  goals: number
  assists: number
  clean_sheet: boolean
}

export default function StatsClient({
  players,
  games,
  stats,
}: {
  players: Player[]
  games: Game[]
  stats: Stat[]
}) {
  const [tab, setTab] = useState<'season' | 'game'>('season')
  const [gameId, setGameId] = useState<string>(games[0]?.id ?? '')
  // edits[player_id] holds unsaved values for the selected game
  const [edits, setEdits] = useState<Record<string, StatRow>>({})
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const game = games.find((g) => g.id === gameId)

  // Season totals per player
  const totals = useMemo(() => {
    const map: Record<string, { goals: number; assists: number; cleanSheets: number; games: number }> = {}
    for (const s of stats) {
      const t = (map[s.player_id] ??= { goals: 0, assists: 0, cleanSheets: 0, games: 0 })
      t.goals += s.goals
      t.assists += s.assists
      if (s.clean_sheet) t.cleanSheets += 1
      t.games += 1
    }
    return map
  }, [stats])

  const leaderboard = players
    .map((p) => ({ player: p, ...(totals[p.id] ?? { goals: 0, assists: 0, cleanSheets: 0, games: 0 }) }))
    .filter((r) => r.goals > 0 || r.assists > 0 || r.cleanSheets > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.cleanSheets - a.cleanSheets)

  function rowFor(playerId: string): StatRow {
    if (edits[playerId]) return edits[playerId]
    const s = stats.find((s) => s.game_id === gameId && s.player_id === playerId)
    return {
      player_id: playerId,
      goals: s?.goals ?? 0,
      assists: s?.assists ?? 0,
      clean_sheet: s?.clean_sheet ?? false,
    }
  }

  function setRow(playerId: string, patch: Partial<StatRow>) {
    setEdits((prev) => ({ ...prev, [playerId]: { ...rowFor(playerId), ...patch } }))
    setFlash(null)
  }

  function selectGame(id: string) {
    setGameId(id)
    setEdits({})
    setFlash(null)
    setError(null)
  }

  const assignedGoals = players.reduce((sum, p) => sum + rowFor(p.id).goals, 0)

  function handleSave() {
    setError(null)
    const rows = players.map((p) => rowFor(p.id))
    startTransition(async () => {
      try {
        await saveGameStats(gameId, rows)
        setEdits({})
        setFlash('Saved.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-white">Stats</h1>

      {/* Tabs */}
      <div className="mb-4 flex gap-1.5">
        {(
          [
            ['season', 'Season'],
            ['game', 'By game'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === key
                ? 'bg-accent text-white ring-1 ring-white/10'
                : 'border border-surface-border text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'season' && (
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
                  <th className="py-2.5 pl-2 pr-4 text-center font-medium">CS</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.player.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pl-4 pr-2 text-slate-500">{i + 1}</td>
                    <td className="max-w-0 truncate px-2 py-2.5 font-medium text-white">
                      {row.player.jersey_number != null && (
                        <span className="mr-1.5 text-slate-500">#{row.player.jersey_number}</span>
                      )}
                      {row.player.full_name}
                    </td>
                    <td className="px-2 py-2.5 text-center font-semibold text-white">{row.goals}</td>
                    <td className="px-2 py-2.5 text-center text-slate-300">{row.assists}</td>
                    <td className="py-2.5 pl-2 pr-4 text-center text-slate-300">
                      {row.cleanSheets > 0 ? row.cleanSheets : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'game' && (
        <>
          {games.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No games yet — add one on the Schedule page.</p>
          ) : (
            <>
              {/* Game picker */}
              <select
                value={gameId}
                onChange={(e) => selectGame(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {fmtDate(g.game_date)} — vs {g.opponent}
                    {g.goals_for != null ? ` (${g.goals_for}–${g.goals_against})` : ''}
                  </option>
                ))}
              </select>

              {/* Goal tally hint */}
              {game?.goals_for != null && (
                <p
                  className={`mb-3 text-xs ${
                    assignedGoals === game.goals_for ? 'text-slate-500' : 'text-amber-400'
                  }`}
                >
                  {assignedGoals} of {game.goals_for} team goals assigned
                </p>
              )}

              {/* Player rows */}
              <div className="card divide-y divide-white/5">
                {players.map((p) => {
                  const row = rowFor(p.id)
                  const isGK = p.position?.includes('GK') ?? false
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {p.jersey_number != null && (
                            <span className="mr-1.5 text-slate-500">#{p.jersey_number}</span>
                          )}
                          {p.full_name}
                        </div>
                      </div>

                      {isGK && (
                        <button
                          onClick={() => setRow(p.id, { clean_sheet: !row.clean_sheet })}
                          className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase transition ${
                            row.clean_sheet
                              ? 'bg-green-900/60 text-green-300'
                              : 'border border-surface-border text-slate-500'
                          }`}
                        >
                          CS
                        </button>
                      )}

                      <Stepper label="G" value={row.goals} onChange={(v) => setRow(p.id, { goals: v })} />
                      <Stepper label="A" value={row.assists} onChange={(v) => setRow(p.id, { assists: v })} />
                    </div>
                  )
                })}
              </div>

              {error && <p className="mt-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}
              {flash && <p className="mt-3 text-center text-sm text-green-400">{flash}</p>}

              <button
                onClick={handleSave}
                disabled={isPending || Object.keys(edits).length === 0}
                className="bg-accent mt-4 w-full rounded-lg py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
              >
                {isPending ? 'Saving…' : 'Save stats'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="w-3 text-center text-[10px] font-semibold uppercase text-slate-500">{label}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-border text-slate-400 transition hover:text-white disabled:opacity-30"
        disabled={value === 0}
      >
        −
      </button>
      <span className={`w-5 text-center text-sm font-semibold ${value > 0 ? 'text-white' : 'text-slate-600'}`}>
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(20, value + 1))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-border text-slate-400 transition hover:text-white"
      >
        +
      </button>
    </div>
  )
}
