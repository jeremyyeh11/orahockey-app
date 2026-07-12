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

function InlineStats({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  const items: { label: string; value: number }[] = []
  if (row.goals > 0) items.push({ label: 'G', value: row.goals })
  if (row.assists > 0) items.push({ label: 'A', value: row.assists })
  if (row.cleanSheets > 0) items.push({ label: 'CS', value: row.cleanSheets })
  if (row.potmWins > 0) items.push({ label: 'POTM', value: row.potmWins })
  if (row.caps > 0) items.push({ label: 'Caps', value: row.caps })

  if (items.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span
          key={s.label}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            isMe ? 'bg-white/15 text-white' : 'bg-white/[0.07] text-slate-400'
          }`}
        >
          {s.value} {s.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Roster cards shared by the admin Squad page (tappable → edit) and the
 * player Squad page (read-only). The signed-in player's row is highlighted.
 * When statsMap is provided, compact season stats are shown inline below
 * the position badges.
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
              {stats && <InlineStats row={stats} isMe={isMe} />}
            </div>
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
