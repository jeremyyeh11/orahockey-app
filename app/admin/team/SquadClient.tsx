'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPlayer, togglePlayerActive } from './actions'
import RosterList from '@/components/RosterList'
import RosterTable from '@/components/RosterTable'
import { defaultPreferredName } from '@/components/RosterList'
import Modal from '@/components/Modal'
import {
  useSeasonStats,
  SeasonSelect,
  TopScorersCard,
  TopAssistsCard,
  type PlayerLite,
  type GameLite,
  type SeasonStat,
  type PotmRow,
  type AttendanceRow,
  type MatchCardRow,
} from '@/components/SeasonStats'
import type { RosterPlayer, AccountStatus } from '@/components/RosterList'

type Player = RosterPlayer & PlayerLite & {
  email: string
  role: 'player' | 'admin'
  auth_user_id: string | null
}

type WhitelistRow = { email: string; invited_at: string | null; claimed_at: string | null }

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
  cards,
  myPlayerId,
  whitelist,
}: {
  players: Player[]
  games: Game[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  cards: MatchCardRow[]
  myPlayerId: string | null
  whitelist: WhitelistRow[]
}) {
  const router = useRouter()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Season stats state
  const { seasons, season, setSeason, topScorerGroups, topAssistGroups, statsMap } = useSeasonStats({
    players,
    games: games as unknown as GameLite[],
    stats,
    potm,
    attendance,
    cards,
  })

  // Account status per player: green = signed in before, amber = invited
  // but not claimed, grey = no account yet
  const wlByEmail = new Map(whitelist.map((w) => [w.email, w]))
  const accountMap = new Map<string, AccountStatus>(
    players.map((p) => {
      const wl = wlByEmail.get(p.email)
      const status: AccountStatus = p.auth_user_id ? 'active' : wl?.invited_at ? 'invited' : 'none'
      return [p.id, status]
    })
  )

  const visible = showInactive ? players : players.filter((p) => p.is_active)
  const rosterProps = {
    players: visible,
    myPlayerId,
    onSelect: (p: Player) => router.push(`/admin/team/${p.id}`, { scroll: false }),
    statsMap,
    accountMap,
  }

  function openAdd() {
    setSelectedPositions([])
    setError(null)
    setShowAddModal(true)
  }

  function togglePosition(pos: string) {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    )
  }

  function parseForm(form: HTMLFormElement): FormData {
    const fd = new FormData(form)
    const jerseyRaw = fd.get('jersey_number') as string
    const preferredRaw = (fd.get('preferred_name') as string).trim()
    return {
      full_name: fd.get('full_name') as string,
      preferred_name: preferredRaw ? preferredRaw.toUpperCase() : null,
      email: fd.get('email') as string,
      jersey_number: jerseyRaw ? Number(jerseyRaw) : null,
      position: selectedPositions.length > 0 ? selectedPositions : null,
      role: fd.get('role') as 'player' | 'admin',
    }
  }

  function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = parseForm(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await addPlayer(data)
        setShowAddModal(false)
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

  const inputCls =
    'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

  return (
    <div className="liga-page p-4">
      {/* Header + season selector + add player */}
      <div className="liga-page-header mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="liga-page-title text-white">Squad</h1>
        <div className="liga-squad-actions flex min-w-0 flex-wrap items-center gap-2">
          <button
            onClick={openAdd}
            className="liga-button liga-button-primary min-h-[44px] bg-accent rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-brand"
          >
            + Add Player
          </button>
          <SeasonSelect seasons={seasons} value={season} onChange={setSeason} />
        </div>
      </div>

      {/* Top Scorers + Top Assists: side by side from sm, a sticky side column next to the roster table at xl+ */}
      <div className="liga-squad-layout xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-6">
        <aside className="liga-squad-summaries mb-4 grid items-start gap-3 sm:grid-cols-2 xl:sticky xl:top-20 xl:order-last xl:mb-0 xl:grid-cols-1">
          <TopScorersCard groups={topScorerGroups} />
          <TopAssistsCard groups={topAssistGroups} />
        </aside>

        <div className="min-w-0">
          {players.some((p) => !p.is_active) && (
            <label className="liga-inactive-toggle liga-meta flex min-h-[44px] items-center gap-2 text-xs text-slate-400 mb-4 cursor-pointer w-fit">
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
            <>
              {/* Cards on touch layouts, a sortable table on desktop */}
              <div className="lg:hidden">
                <RosterList {...rosterProps} />
              </div>
              <div className="hidden lg:block">
                <RosterTable {...rosterProps} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Player modal (separate from profile) */}
      {showAddModal && (
        <Modal onClose={() => { setShowAddModal(false); setError(null) }}>
          <h2 className="text-lg font-bold text-white mb-5">Add Player</h2>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input name="full_name" type="text" required className={inputCls} placeholder="John Smith" />
            </div>
            <div>
              <label className={labelCls}>Preferred Name</label>
              <input name="preferred_name" type="text" className={inputCls} placeholder="Auto (first name)" />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input name="email" type="email" required className={inputCls} placeholder="player@example.com" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Jersey #</label>
                <input name="jersey_number" type="number" min="0" max="99" className={inputCls} placeholder="—" />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Position</label>
                <div className="flex gap-1.5 flex-wrap">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => togglePosition(pos)}
                      className={`liga-button rounded-lg px-2.5 py-2 text-xs font-semibold border transition ${
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
              <label className={labelCls}>Role</label>
              <select name="role" className={inputCls} defaultValue="player">
                <option value="player">Player</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && (
              <p className="liga-alert liga-alert-error rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setError(null) }}
                className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="liga-button liga-button-primary bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
