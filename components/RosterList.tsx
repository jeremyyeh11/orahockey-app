'use client'

import type { LeaderboardRow } from './SeasonStats'

export type RosterPlayer = {
  id: string
  full_name: string
  jersey_number: number | null
  position: string[] | null
  is_active: boolean
}

const POSITION_ORDER: Record<string, number> = { FWD: 0, MID: 1, DEF: 2, GK: 3 }

export function sortPositions(pos: string[] | null | undefined) {
  return [...(pos ?? [])].sort(
    (a, b) => (POSITION_ORDER[a] ?? 9) - (POSITION_ORDER[b] ?? 9)
  )
}

const STAT_COLS = ['G', 'A', 'CS', 'POTM', 'Caps'] as const

function statValue(row: LeaderboardRow, col: string): number {
  switch (col) {
    case 'G': return row.goals
    case 'A': return row.assists
    case 'CS': return row.cleanSheets
    case 'POTM': return row.potmWins
    case 'Caps': return row.caps
    default: return 0
  }
}

function StatGrid({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-1 mt-2">
      {STAT_COLS.map((col) => {
        const v = statValue(row, col)
        return (
          <div key={col} className="text-center">
            <div className={`text-sm font-semibold ${v > 0 ? (isMe ? 'text-white' : 'text-white') : 'text-slate-600'}`}>
              {v > 0 ? v : '–'}
            </div>
            <div className={`text-[9px] uppercase tracking-wide ${isMe ? 'text-white/60' : 'text-slate-500'}`}>
              {col}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatHeader() {
  return (
    <div className="grid grid-cols-5 gap-1 px-4 pb-1">
      {STAT_COLS.map((col) => (
        <div key={col} className="text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {col}
        </div>
      ))}
    </div>
  )
}

/**
 * Roster cards shared by the admin Squad page (tappable → edit) and the
 * player Squad page (read-only). The signed-in player's row is highlighted.
 * When statsMap is provided, compact season stats are shown in aligned
 * columns below each player's name.
 */
export default function RosterList<T extends RosterPlayer>({
  players,
  myPlayerId,
  onSelect,
  statsMap,
}: {
  players: T[]
  myPlayerId: string | null
  onSelect?: (player: T) => void
  statsMap?: Map<string, LeaderboardRow>
}) {
  return (
    <div className="space-y-2">
      {statsMap && <StatHeader />}
      {players.map((player) => {
        const isMe = player.id === myPlayerId
        const stats = statsMap?.get(player.id)
        // Own row gets the dashboard hero treatment: solid green, white text
        const cardCls = `relative block w-full overflow-hidden rounded-xl px-4 py-3 text-left transition ${
          isMe ? 'bg-accent ring-1 ring-white/10' : 'border border-surface-border bg-surface-card'
        } ${!player.is_active ? 'opacity-50' : ''}`

        const inner = (
          <>
            {/* Jersey number watermark — same treatment as the dashboard hero icon */}
            {player.jersey_number != null && (
              <span
                aria-hidden
                className="pointer-events-none absolute -top-1.5 right-2 select-none font-display text-[2.75rem] font-extrabold leading-none text-white opacity-15"
              >
                {player.jersey_number}
              </span>
            )}

            <div className="relative min-w-0 pr-16">
              <div className="truncate font-semibold text-white">{player.full_name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {sortPositions(player.position).map((pos) => (
                  <span
                    key={pos}
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      isMe ? 'bg-white/15 text-white' : 'bg-white/[0.07] text-slate-300'
                    }`}
                  >
                    {pos}
                  </span>
                ))}
              </div>
            </div>
            {stats && <StatGrid row={stats} isMe={isMe} />}
          </>
        )

        return onSelect ? (
          <button
            key={player.id}
            onClick={() => onSelect(player)}
            className={`${cardCls} hover:border-white/20`}
          >
            {inner}
          </button>
        ) : (
          <div key={player.id} className={cardCls}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
