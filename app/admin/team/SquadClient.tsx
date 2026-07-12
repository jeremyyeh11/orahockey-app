'use client'

import { useState, useTransition } from 'react'
import { addPlayer, updatePlayer, togglePlayerActive } from './actions'
import { saveGameStats, type StatRow } from '../stats/actions'
import RosterList from '@/components/RosterList'
import { defaultPreferredName, splitName } from '@/components/RosterList'
import { fmtDate } from '@/lib/format'
import {
  computeSeason,
  seasonsOf,
  SeasonSelect,
  PotsCard,
  type PlayerLite,
  type GameLite,
  type SeasonStat,
  type PotmRow,
  type AttendanceRow,
} from '@/components/SeasonStats'
import type { RosterPlayer } from '@/components/RosterList'

type Player = RosterPlayer & PlayerLite & {
  email: string
  role: 'player' | 'admin'
  auth_user_id: string | null
}

type Game = {
  id: string
  opponent: string
  game_date: string
  goals_for: number | null
  goals_against: number | null
  result: string | null
}

type FormData = {
  full_name: string
  preferred_name: string | null
  email: string
  jersey_number: number | null
  position: string[] | null
  role: 'player' | 'admin'
}

const POSITIONS = ['FWD', 'MID', 'DEF', 'GK'] as const

export default function SquadClient({
  players,
  games,
  stats,
  potm,
  attendance,
  myPlayerId,
}: {
  players: Player[]
  games: Game[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  myPlayerId: string | null
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Season stats state
  const seasons = seasonsOf(games)
  const [season, setSeason] = useState<string>(seasons[0] ?? String(new Date().getFullYear()))
  const [tab, setTab] = useState<'squad' | 'game'>('squad')

  const { seasonGames, leaderboard, pots } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    season,
  })
  const statsMap = new Map(leaderboard.map((r) => [r.player.id, r]))

  // By-game stat entry state
  const entryGames = games.filter((g) => seasonGames.some((sg) => sg.id === g.id))
  const [gameId, setGameId] = useState<string>(entryGames[0]?.id ?? '')
  const [edits, setEdits] = useState<Record<string, StatRow>>({})
  const [flash, setFlash] = useState<string | null>(null)
  const [statError, setStatError] = useState<string | null>(null)

  const game = entryGames.find((g) => g.id === gameId) ?? entryGames[0]
  const activeGameId = game?.id ?? ''

  const visible = showInactive ? players : players.filter((p) => p.is_active)

  function openAdd() {
    setEditingPlayer(null)
    setSelectedPositions([])
    setError(null)
    setShowModal(true)
  }

  function openEdit(player: Player) {
    setEditingPlayer(player)
    setSelectedPositions(player.position ?? [])
    setError(null)
    setShowModal(true)
  }

  function togglePosition(pos: string) {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    )
  }

  function closeModal() {
    setShowModal(false)
    setEditingPlayer(null)
    setError(null)
  }

  function parseForm(form: HTMLFormElement): FormData {
    const fd = new FormData(form)
    const jerseyRaw = fd.get('jersey_number') as string
    const preferredRaw = (fd.get('preferred_name') as string).trim()
    return {
      full_name: fd.get('full_name') as string,
      preferred_name: preferredRaw || null,
      email: fd.get('email') as string,
      jersey_number: jerseyRaw ? Number(jerseyRaw) : null,
      position: selectedPositions.length > 0 ? selectedPositions : null,
      role: fd.get('role') as 'player' | 'admin',
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = parseForm(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        if (editingPlayer) {
          await updatePlayer(editingPlayer.id, data)
        } else {
          await addPlayer(data)
        }
        closeModal()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleToggleActive(player: Player) {
    startTransition(async () => {
      await togglePlayerActive(player.id, !player.is_active)
    })
  }

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
    setStatError(null)
  }

  function selectSeason(s: string) {
    setSeason(s)
    setEdits({})
    setGameId('')
    setFlash(null)
    setStatError(null)
  }

  const assignedGoals = players.reduce((sum, p) => {
    const r = rowFor(p.id)
    return sum + r.goals_fg + r.goals_pc + r.goals_ps
  }, 0)

  function handleSave() {
    setStatError(null)
    const rows = players.map((p) => rowFor(p.id))
    startTransition(async () => {
      try {
        await saveGameStats(activeGameId, rows)
        setEdits({})
        setFlash('Saved.')
      } catch (err) {
        setStatError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="p-4">
      {/* Header + season selector + add player */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Squad</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openAdd}
            className="bg-accent rounded-lg border border-surface-border px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-brand"
          >
            + Add Player
          </button>
          <SeasonSelect seasons={seasons} value={season} onChange={selectSeason} />
        </div>
      </div>

      {/* Tabs: Squad | By game */}
      <div className="mb-4 flex gap-1.5">
        {(
          [
            ['squad', 'Squad'],
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

      {tab === 'squad' && (
        <>
          {/* POTS race card */}
          <PotsCard pots={pots} />

          {players.some((p) => !p.is_active) && (
            <label className="flex items-center gap-2 text-sm text-slate-400 mb-4 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded accent-brand"
              />
              Show inactive
            </label>
          )}

          {visible.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No players yet. Add one above.</p>
          ) : (
            <RosterList
              players={visible}
              myPlayerId={myPlayerId}
              onSelect={openEdit}
              statsMap={statsMap}
            />
          )}
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

              {game?.goals_for != null && (
                <p
                  className={`mb-3 text-xs ${
                    assignedGoals === game.goals_for ? 'text-slate-500' : 'text-amber-400'
                  }`}
                >
                  {assignedGoals} of {game.goals_for} team goals assigned
                </p>
              )}

              <div className="card divide-y divide-white/5">
                {players.map((p) => {
                  const row = rowFor(p.id)
                  const isGK = p.position?.includes('GK') ?? false
                  return (
                    <div key={p.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                          {(() => {
                            const [preferred, rest] = splitName(p)
                            return (
                              <>
                                <span>{preferred}</span>
                                {rest && <span className="text-xs font-normal tracking-wide text-slate-400"> {rest}</span>}
                              </>
                            )
                          })()}
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

              {statError && <p className="mt-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{statError}</p>}
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

      {/* Player edit/add modal */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closeModal} />
          <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface-card border border-surface-border px-6 pt-6 pb-8 shadow-xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
            <h2 className="text-lg font-bold text-white mb-5">
              {editingPlayer ? 'Edit Player' : 'Add Player'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                <input
                  name="full_name"
                  type="text"
                  required
                  defaultValue={editingPlayer?.full_name}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Preferred Name</label>
                <input
                  name="preferred_name"
                  type="text"
                  defaultValue={editingPlayer?.preferred_name ?? ''}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder={editingPlayer ? defaultPreferredName(editingPlayer.full_name) : 'Auto (first name)'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={editingPlayer?.email}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="player@example.com"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Jersey #</label>
                  <input
                    name="jersey_number"
                    type="number"
                    min="1"
                    max="99"
                    defaultValue={editingPlayer?.jersey_number ?? ''}
                    className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    placeholder="—"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Position</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => togglePosition(pos)}
                        className={`rounded-lg px-2.5 py-2 text-xs font-semibold border transition ${
                          selectedPositions.includes(pos)
                            ? 'bg-accent border-transparent text-white ring-1 ring-white/10'
                            : 'border-surface-border text-slate-400 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  name="role"
                  defaultValue={editingPlayer?.role ?? 'player'}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="player">Player</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {error && (
                <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
