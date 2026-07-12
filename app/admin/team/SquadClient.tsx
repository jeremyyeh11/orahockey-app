'use client'

import { useState, useTransition } from 'react'
import { addPlayer, updatePlayer, togglePlayerActive } from './actions'
import RosterList from '@/components/RosterList'
import { defaultPreferredName } from '@/components/RosterList'
import {
  computeSeason,
  seasonsOf,
  SeasonSelect,
  PotsCard,
  TopScorersCard,
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

  const { leaderboard, pots, topScorers } = computeSeason({
    players,
    games,
    stats,
    potm,
    attendance,
    season,
  })
  const statsMap = new Map(leaderboard.map((r) => [r.player.id, r]))

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

  function selectSeason(s: string) {
    setSeason(s)
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

      {/* POTS race + Top scorers — side by side */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <PotsCard pots={pots} />
        <TopScorersCard scorers={topScorers} />
      </div>

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
                    min="0"
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
