'use client'

import { useState } from 'react'
import { ReadEditModal } from './ReadEditModal'
import { preferredName, splitName, sortPositions } from './RosterList'
import type { LeaderboardRow, PlayerLite } from './SeasonStats'

export type ProfilePlayer = PlayerLite & {
  position: string[] | null
  is_active: boolean
  email?: string
  role?: 'player' | 'admin'
}

const inputCls =
  'w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

const POSITIONS = ['FWD', 'MID', 'DEF', 'GK'] as const

function StatGrid({ row, positions }: { row: LeaderboardRow; positions: string[] | null }) {
  const isGK = positions?.includes('GK') ?? false
  const isOutfield = positions?.some((p) => p !== 'GK') ?? false

  const showGoals = isOutfield
  const showCS = isGK

  const stats: { label: string; value: number }[] = []
  if (showGoals) {
    stats.push({ label: 'FG', value: row.fg })
    stats.push({ label: 'PC', value: row.pc })
    stats.push({ label: 'PS', value: row.ps })
    stats.push({ label: 'A', value: row.assists })
  }
  if (showCS) {
    stats.push({ label: 'CS', value: row.cleanSheets })
  }
  stats.push({ label: 'POTM', value: row.potmWins })
  stats.push({ label: 'POTS Pts', value: row.potsPts })
  stats.push({ label: 'Caps', value: row.caps })

  const totalGoals = row.goals

  return (
    <div className="grid grid-cols-3 gap-2">
      {showGoals && (
        <div className="rounded-lg bg-brand/10 px-3 py-2 text-center ring-1 ring-brand/20">
          <div className="text-xl font-bold text-white">{totalGoals}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Goals</div>
        </div>
      )}
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-lg px-3 py-2 text-center ${s.value > 0 ? 'bg-white/5' : 'bg-white/[0.02]'}`}
        >
          <div className={`text-lg font-bold ${s.value > 0 ? 'text-white' : 'text-slate-600'}`}>
            {s.value > 0 ? s.value : '—'}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function CardBadges({ row }: { row: LeaderboardRow }) {
  const { green, yellow, red } = row.cards
  if (green === 0 && yellow === 0 && red === 0) return null

  return (
    <div className="flex items-center gap-2">
      {green > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs">
          <span className="text-green-400">▲</span>
          <span className="text-slate-300">{green}</span>
        </span>
      )}
      {yellow > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs">
          <span className="text-yellow-400">■</span>
          <span className="text-slate-300">{yellow}</span>
        </span>
      )}
      {red > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs">
          <span className="text-red-400">●</span>
          <span className="text-slate-300">{red}</span>
        </span>
      )}
    </div>
  )
}

export function PlayerProfileModal({
  player,
  seasonRow,
  careerRow,
  seasonLabel,
  isAdmin,
  onClose,
  onSave,
  isPending,
}: {
  player: ProfilePlayer | null
  seasonRow: LeaderboardRow | undefined
  careerRow: LeaderboardRow | undefined
  seasonLabel: string
  isAdmin: boolean
  onClose: () => void
  onSave: (data: {
    preferred_name: string | null
    jersey_number: number | null
    position: string[] | null
    role: 'player' | 'admin'
  }) => void
  isPending: boolean
}) {
  const [editMode, setEditMode] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState<string[]>(player?.position ?? [])

  if (!player) return null

  const { before, beforeSep, preferred, afterSep, after } = splitName(player)
  const positions = sortPositions(player.position)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const preferredRaw = (fd.get('preferred_name') as string).trim()
    const jerseyRaw = fd.get('jersey_number') as string
    onSave({
      preferred_name: preferredRaw ? preferredRaw.toUpperCase() : null,
      jersey_number: jerseyRaw ? Number(jerseyRaw) : null,
      position: selectedPositions.length > 0 ? selectedPositions : null,
      role: fd.get('role') as 'player' | 'admin',
    })
    setEditMode(false)
  }

  function togglePosition(pos: string) {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    )
  }

  return (
    <ReadEditModal
      title=""
      isOpen={!!player}
      onClose={onClose}
      isAdmin={isAdmin}
      editMode={editMode}
      onEnterEdit={() => {
        setSelectedPositions(player.position ?? [])
        setEditMode(true)
      }}
      onSave={() => {
        const form = document.getElementById('player-profile-form') as HTMLFormElement | null
        form?.requestSubmit()
      }}
      onDiscard={() => setEditMode(false)}
      isPending={isPending}
    >
      {/* READ MODE — Trading card layout */}
      {!editMode && (
        <div className="space-y-4">
          {/* Hero area — ~45% of modal height, trading card style */}
          <div className="relative -mx-6 -mt-6 h-[38vh] max-h-[280px] min-h-[180px] overflow-hidden rounded-t-2xl bg-gradient-to-b from-brand/20 via-surface to-surface-card">
            {/* Large faded jersey number as background */}
            {player.jersey_number != null && (
              <span
                aria-hidden
                className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none font-display text-[8rem] font-extrabold leading-none text-white/10"
              >
                {player.jersey_number}
              </span>
            )}
            {/* Placeholder silhouette — replaced by player photo later */}
            <div className="absolute inset-0 flex items-end justify-center pb-2">
              <svg
                viewBox="0 0 100 120"
                className="h-[85%] w-auto opacity-20"
                fill="currentColor"
              >
                <circle cx="50" cy="22" r="14" />
                <path d="M30 50 Q50 38 70 50 L70 80 L65 80 L65 55 L60 55 L60 120 L55 120 L55 80 L45 80 L45 120 L40 120 L40 55 L35 55 L35 80 L30 80 Z" />
              </svg>
            </div>
            {/* Name overlay at bottom of hero */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-card to-transparent px-6 pb-2 pt-8">
              <div className="text-lg font-bold text-white">
                {before && <span className="text-sm font-normal tracking-wide text-slate-400">{before}{beforeSep}</span>}
                <span>{preferred}</span>
                {after && <span className="text-sm font-normal tracking-wide text-slate-400">{afterSep}{after}</span>}
              </div>
              {positions.length > 0 && (
                <div className="mt-1 flex gap-1.5">
                  {positions.map((pos) => (
                    <span key={pos} className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                      {pos}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Season stats */}
          {seasonRow && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {seasonLabel} Season
              </h3>
              <StatGrid row={seasonRow} positions={player.position} />
              <div className="mt-2 flex justify-end">
                <CardBadges row={seasonRow} />
              </div>
            </div>
          )}

          {/* Career stats */}
          {careerRow && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Career</h3>
              <StatGrid row={careerRow} positions={player.position} />
            </div>
          )}

          {/* No stats yet */}
          {!seasonRow && !careerRow && (
            <p className="py-4 text-center text-sm text-slate-500">No stats recorded yet.</p>
          )}
        </div>
      )}

      {/* EDIT MODE (admins only) */}
      {editMode && (
        <form id="player-profile-form" onSubmit={handleSave} className="space-y-4">
          {/* Compact hero in edit mode */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-surface">
              <span className="text-2xl font-bold text-slate-500">
                {player.jersey_number ?? '—'}
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">{preferredName(player)}</div>
              <div className="text-xs text-slate-500">{player.position?.join(' / ') || 'No position'}</div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Preferred Name</label>
            <input
              name="preferred_name"
              type="text"
              defaultValue={player.preferred_name ?? ''}
              className={inputCls}
              placeholder={preferred}
            />
          </div>
          <div>
            <label className={labelCls}>Jersey #</label>
            <input
              name="jersey_number"
              type="number"
              min="0"
              max="99"
              defaultValue={player.jersey_number ?? ''}
              className={inputCls}
              placeholder="—"
            />
          </div>
          <div>
            <label className={labelCls}>Position</label>
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
          {isAdmin && player.role && (
            <div>
              <label className={labelCls}>Role</label>
              <select
                name="role"
                defaultValue={player.role}
                className={inputCls}
              >
                <option value="player">Player</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
        </form>
      )}
    </ReadEditModal>
  )
}
