'use client'

import { useState, useTransition } from 'react'
import { saveGameStats, type StatRow } from './actions'
import { fmtDate } from '@/lib/format'
import {
  computeSeason,
  seasonsOf,
  SeasonSelect,
  PotsCard,
  LeaderboardTable,
  type SeasonStat,
  type PotmRow,
  type AttendanceRow,
} from '@/components/SeasonStats'

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

export default function StatsClient({
  players,
  games,
  stats,
  potm,
  attendance,
}: {
  players: Player[]
  games: Game[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
}) {
  const seasons = seasonsOf(games)
  const [season, setSeason] = useState<string>(seasons[0] ?? String(new Date().getFullYear()))
  const [tab, setTab] = useState<'season' | 'game'>('season')

  const { seasonGames, leaderboard, pots } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    season,
  })
  const entryGames = games.filter((g) => seasonGames.some((sg) => sg.id === g.id))

  const [gameId, setGameId] = useState<string>(entryGames[0]?.id ?? '')
  // edits[player_id] holds unsaved values for the selected game
  const [edits, setEdits] = useState<Record<string, StatRow>>({})
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const game = entryGames.find((g) => g.id === gameId) ?? entryGames[0]
  const activeGameId = game?.id ?? ''

  function rowFor(playerId: string): StatRow {
    if (edits[playerId]) return edits[playerId]
    const s = stats.find((s) => s.game_id === activeGameId && s.player_id === playerId)
    return {
      player_id: playerId,
      goals_fg: s?.goals_fg ?? 0,
      goals_pc: s?.goals_pc ?? 0,
      goals_ps: s?.goals_ps ?? 0,
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

  function selectSeason(s: string) {
    setSeason(s)
    setEdits({})
    setGameId('')
    setFlash(null)
    setError(null)
  }

  const assignedGoals = players.reduce((sum, p) => {
    const r = rowFor(p.id)
    return sum + r.goals_fg + r.goals_pc + r.goals_ps
  }, 0)

  function handleSave() {
    setError(null)
    const rows = players.map((p) => rowFor(p.id))
    startTransition(async () => {
      try {
        await saveGameStats(activeGameId, rows)
        setEdits({})
        setFlash('Saved.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Stats</h1>
        <SeasonSelect seasons={seasons} value={season} onChange={selectSeason} />
      </div>

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
        <>
          <PotsCard pots={pots} />
          <LeaderboardTable rows={leaderboard} />
        </>
      )}

      {tab === 'game' && (
        <>
          {entryGames.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No games this season — add one on the Schedule page.
            </p>
          ) : (
            <>
              {/* Game picker */}
              <select
                value={activeGameId}
                onChange={(e) => selectGame(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {entryGames.map((g) => (
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
                    <div key={p.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                          {p.full_name}
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
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <Stepper label="FG" value={row.goals_fg} onChange={(v) => setRow(p.id, { goals_fg: v })} />
                        <Stepper label="PC" value={row.goals_pc} onChange={(v) => setRow(p.id, { goals_pc: v })} />
                        <Stepper label="PS" value={row.goals_ps} onChange={(v) => setRow(p.id, { goals_ps: v })} />
                        <Stepper label="A" value={row.assists} onChange={(v) => setRow(p.id, { assists: v })} />
                      </div>
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
      <span className="w-5 text-center text-[10px] font-semibold uppercase text-slate-500">{label}</span>
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
