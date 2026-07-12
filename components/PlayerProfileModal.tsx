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
      {/* Total goals as a highlighted stat */}
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
  const isMeHighlight = false // highlight is handled by parent

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
      title={preferredName(player)}
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
      {/* READ MODE */}
      {!editMode && (
        <div className="space-y-5">
          {/* Photo placeholder — trading card area */}
          <div className="flex flex-col items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-surface-border bg-surface">
              <span className="text-3xl font-bold text-slate-600">
                {player.jersey_number ?? '—'}
              </span>
            </div>
          </div>

          {/* Name */}
          <div className="text-center">
            <div className="text-base font-bold text-white">
              {before && <span className="text-sm font-normal tracking-wide text-slate-400">{before}{beforeSep}</span>}
              <span>{preferred}</span>
              {after && <span className="text-sm font-normal tracking-wide text-slate-400">{afterSep}{after}</span>}
            </div>
            {positions.length > 0 && (
              <div className="mt-1.5 flex justify-center gap-1.5">
                {positions.map((pos) => (
                  <span key={pos} className="rounded bg-white/[0.07] px-1.5 py-0.5 text-xs font-medium text-slate-300">
                    {pos}
                  </span>
                ))}
              </div>
            )}
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
