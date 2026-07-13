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

// Inline stat row — same compact style as squad cards
function StatLine({ row, positions }: { row: LeaderboardRow; positions: string[] | null }) {
  const isGK = positions?.includes('GK') ?? false
  const isOutfield = positions?.some((p) => p !== 'GK') ?? false

  const showGoals = isOutfield
  const showCS = isGK

  const valCls = (v: number) => v > 0 ? 'text-white' : 'text-slate-600'
  const lblCls = 'text-white/50'

  const cols: { label: string; value: number }[] = []
  if (showGoals) {
    cols.push({ label: 'FG', value: row.fg })
    cols.push({ label: 'PC', value: row.pc })
    cols.push({ label: 'PS', value: row.ps })
    cols.push({ label: 'A', value: row.assists })
  }
  if (showCS) cols.push({ label: 'CS', value: row.cleanSheets })
  cols.push({ label: 'POTM', value: row.potmWins })
  cols.push({ label: 'CAPS', value: row.caps })

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px]">
      {cols.map((c) => (
        <span key={c.label} className="inline-flex items-baseline gap-0.5">
          <span className={`font-semibold ${valCls(c.value)}`}>{c.value > 0 ? c.value : '–'}</span>
          <span className={lblCls}>{c.label}</span>
        </span>
      ))}
    </div>
  )
}

function CardBadges({ row }: { row: LeaderboardRow }) {
  const { green, yellow, red } = row.cards
  if (green === 0 && yellow === 0 && red === 0) return null
  return (
    <div className="flex items-center gap-1.5">
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
      {/* READ MODE — Full-bleed image with translucent stats overlay */}
      {!editMode && (
        <div className="space-y-0">
          {/* Full-screen image area — the modal IS the image */}
          <div className="relative -mx-6 -mt-6 min-h-[60vh]">
            {/* Layer 1: Solid gradient background behind image */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand/25 via-surface-card to-surface-card" />

            {/* Large faded jersey number */}
            {player.jersey_number != null && (
              <span
                aria-hidden
                className="pointer-events-none absolute -right-4 top-8 select-none font-display text-[7rem] font-extrabold leading-none text-white/8"
              >
                {player.jersey_number}
              </span>
            )}

            {/* Player image placeholder — will be replaced with real photo */}
            {/* Full height, centered */}
            <div className="absolute inset-0 flex items-start justify-center pt-8">
              <svg
                viewBox="0 0 100 130"
                className="h-[50vh] w-auto opacity-25"
                fill="currentColor"
              >
                <circle cx="50" cy="18" r="12" />
                <path d="M32 40 Q50 30 68 40 L68 72 L63 72 L63 48 L58 48 L58 130 L53 130 L53 72 L47 72 L47 130 L42 130 L42 48 L37 48 L37 72 L32 72 Z" />
              </svg>
            </div>

            {/* Layer 2: Translucent stats overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0">
              {/* Gradient fade for name */}
              <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pt-10 pb-2">
                {/* Name + position */}
                <div className="text-lg font-bold text-white">
                  {before && <span className="text-sm font-normal tracking-wide text-slate-400">{before}{beforeSep}</span>}
                  <span>{preferred}</span>
                  {after && <span className="text-sm font-normal tracking-wide text-slate-400">{afterSep}{after}</span>}
                </div>
                {positions.length > 0 && (
                  <div className="mt-1 flex gap-1.5">
                    {positions.map((pos) => (
                      <span key={pos} className="rounded bg-white/[0.1] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                        {pos}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Translucent stat panel */}
              {seasonRow && (
                <div className="bg-black/50 backdrop-blur-sm px-6 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {seasonLabel}
                    </span>
                    <CardBadges row={seasonRow} />
                  </div>
                  <StatLine row={seasonRow} positions={player.position} />
                </div>
              )}

              {/* Career stats — slightly more opaque */}
              {careerRow && (
                <div className="bg-black/70 backdrop-blur-sm px-6 py-3">
                  <div className="mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Career
                    </span>
                  </div>
                  <StatLine row={careerRow} positions={player.position} />
                </div>
              )}

              {/* No stats */}
              {!seasonRow && !careerRow && (
                <div className="bg-black/50 backdrop-blur-sm px-6 py-4">
                  <p className="text-center text-sm text-slate-500">No stats recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODE (admins only) */}
      {editMode && (
        <form id="player-profile-form" onSubmit={handleSave} className="space-y-4">
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
            <input name="preferred_name" type="text" defaultValue={player.preferred_name ?? ''} className={inputCls} placeholder={preferred} />
          </div>
          <div>
            <label className={labelCls}>Jersey #</label>
            <input name="jersey_number" type="number" min="0" max="99" defaultValue={player.jersey_number ?? ''} className={inputCls} placeholder="—" />
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
              <select name="role" defaultValue={player.role} className={inputCls}>
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
