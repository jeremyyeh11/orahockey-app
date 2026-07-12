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

function CardShapes({ row }: { row: LeaderboardRow }) {
  const { green, yellow, red } = row.cards
  if (green === 0 && yellow === 0 && red === 0) {
    return <span className="text-slate-600">–</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      {green > 0 && <span className="text-green-400 text-xs">▲{green > 1 ? green : ''}</span>}
      {yellow > 0 && <span className="text-yellow-400 text-xs">■{yellow > 1 ? yellow : ''}</span>}
      {red > 0 && <span className="text-red-400 text-xs">●{red > 1 ? red : ''}</span>}
    </span>
  )
}

function statVal(v: number) {
  return v > 0 ? v : '–'
}

/**
 * Table-style roster. Name | # | Caps | G | A | CS | POTM | Cards
 * When statsMap is provided, stat columns are shown.
 * Admin rows are tappable (onSelect) — the whole row is a button.
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
  const hasStats = !!statsMap

  function Row({ player }: { player: T }) {
    const isMe = player.id === myPlayerId
    const stats = statsMap?.get(player.id)
    const rowCls = `border-b border-white/5 last:border-0 ${
      isMe ? 'bg-accent/20' : ''
    } ${!player.is_active ? 'opacity-50' : ''} ${onSelect ? 'cursor-pointer hover:bg-white/5' : ''}`

    const cells = (
      <>
        <td className="py-2.5 pl-4 pr-2">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-white">{player.full_name}</span>
            <span className="flex shrink-0 gap-0.5">
              {sortPositions(player.position).map((pos) => (
                <span
                  key={pos}
                  className="rounded bg-white/[0.07] px-1 py-0.5 text-[9px] font-medium text-slate-400"
                >
                  {pos}
                </span>
              ))}
            </span>
          </div>
        </td>
        <td className="px-1.5 py-2.5 text-center text-sm text-slate-400">
          {player.jersey_number ?? '–'}
        </td>
        <td className="px-1.5 py-2.5 text-center text-sm text-slate-300">
          {hasStats ? statVal(stats?.caps ?? 0) : '–'}
        </td>
        {hasStats && (
          <>
            <td className="px-1.5 py-2.5 text-center text-sm font-semibold text-white">
              {statVal(stats?.goals ?? 0)}
            </td>
            <td className="px-1.5 py-2.5 text-center text-sm text-slate-300">
              {statVal(stats?.assists ?? 0)}
            </td>
            <td className="px-1.5 py-2.5 text-center text-sm text-slate-300">
              {statVal(stats?.cleanSheets ?? 0)}
            </td>
            <td className="px-1.5 py-2.5 text-center text-sm text-slate-300">
              {statVal(stats?.potmWins ?? 0)}
            </td>
            <td className="py-2.5 pl-1.5 pr-4 text-center">
              {stats ? <CardShapes row={stats} /> : <span className="text-slate-600">–</span>}
            </td>
          </>
        )}
      </>
    )

    return onSelect ? (
      <tr key={player.id} className={rowCls} onClick={() => onSelect(player)}>
        {cells}
      </tr>
    ) : (
      <tr key={player.id} className={rowCls}>
        {cells}
      </tr>
    )
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[9px] uppercase tracking-wide text-slate-500">
            <th className="py-2.5 pl-4 pr-2 font-medium">Name</th>
            <th className="px-1.5 py-2.5 text-center font-medium">#</th>
            <th className="px-1.5 py-2.5 text-center font-medium">Caps</th>
            {hasStats && (
              <>
                <th className="px-1.5 py-2.5 text-center font-medium">G</th>
                <th className="px-1.5 py-2.5 text-center font-medium">A</th>
                <th className="px-1.5 py-2.5 text-center font-medium">CS</th>
                <th className="px-1.5 py-2.5 text-center font-medium">POTM</th>
                <th className="py-2.5 pl-1.5 pr-4 text-center font-medium">Cards</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <Row key={p.id} player={p} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
