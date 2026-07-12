'use client'

export type RosterPlayer = {
  id: string
  full_name: string
  jersey_number: number | null
  position: string[] | null
  is_active: boolean
}

const POSITION_ORDER: Record<string, number> = { FWD: 0, MID: 1, DEF: 2, GK: 3 }

export const POSITION_COLORS: Record<string, string> = {
  FWD: 'bg-orange-900/50 text-orange-300',
  MID: 'bg-green-900/50 text-green-300',
  DEF: 'bg-blue-900/50 text-blue-300',
  GK: 'bg-purple-900/50 text-purple-300',
}

export function sortPositions(pos: string[] | null | undefined) {
  return [...(pos ?? [])].sort(
    (a, b) => (POSITION_ORDER[a] ?? 9) - (POSITION_ORDER[b] ?? 9)
  )
}

/**
 * Roster cards shared by the admin Team page (tappable → edit) and the
 * player Team page (read-only). The signed-in player's row is highlighted.
 */
export default function RosterList<T extends RosterPlayer>({
  players,
  myPlayerId,
  onSelect,
}: {
  players: T[]
  myPlayerId: string | null
  onSelect?: (player: T) => void
}) {
  return (
    <div className="space-y-2">
      {players.map((player) => {
        const isMe = player.id === myPlayerId
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
                      isMe
                        ? 'bg-white/15 text-white'
                        : POSITION_COLORS[pos] ?? 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {pos}
                  </span>
                ))}
              </div>
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
