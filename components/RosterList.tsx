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

function CardShape({ color, count }: { color: 'green' | 'yellow' | 'red'; count: number }) {
  if (count === 0) return null
  const shapes = {
    green: <span className="text-green-400">▲</span>,
    yellow: <span className="text-yellow-400">■</span>,
    red: <span className="text-red-400">●</span>,
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs">
      {shapes[color]}
      <span className="text-slate-400">{count}</span>
    </span>
  )
}


function CardsCell({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  const { green, yellow, red } = row.cards
  if (green === 0 && yellow === 0 && red === 0) {
    return <span className="text-slate-600 text-xs">–</span>
  }
  return (
    <div className="flex items-center gap-1.5">
      <CardShape color="green" count={green} />
      <CardShape color="yellow" count={yellow} />
      <CardShape color="red" count={red} />
    </div>
  )
}

const STAT_COLS = ['FG', 'PC', 'PS', 'A', 'CS', 'POTM', 'Caps'] as const

function statValue(row: LeaderboardRow, col: string): number {
  switch (col) {
    case 'FG': return row.fg
    case 'PC': return row.pc
    case 'PS': return row.ps
    case 'A': return row.assists
    case 'CS': return row.cleanSheets
    case 'POTM': return row.potmWins
    case 'Caps': return row.caps
    default: return 0
  }
}

function StatRow({ row, isMe, positions }: { row: LeaderboardRow; isMe: boolean; positions: string[] | null }) {
  const valCls = (v: number) =>
    v > 0 ? (isMe ? 'text-white' : 'text-white') : 'text-slate-600'
  const labelCls = isMe ? 'text-white/50' : 'text-slate-500'

  const isGK = positions?.includes('GK') ?? false
  const isOutfield = positions?.some((p) => p !== 'GK') ?? false

  // GK-only: show CS, hide FG/PC/PS/A
  // Outfield-only: show FG/PC/PS/A, hide CS
  // Both (GK + outfield): show everything
  const showGoals = isOutfield
  const showCS = isGK

  const cols: string[] = []
  if (showGoals) cols.push('FG', 'PC', 'PS', 'A')
  if (showCS) cols.push('CS')
  cols.push('POTM', 'Caps')

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1.5 text-[11px]">
      {cols.map((col) => {
        const v = statValue(row, col)
        return (
          <span key={col} className="inline-flex items-baseline gap-0.5">
            <span className={`font-semibold ${valCls(v)}`}>{v > 0 ? v : '–'}</span>
            <span className={labelCls}>{col}</span>
          </span>
        )
      })}
    </div>
  )
}

function StatHeader() {
  return (
    <div className="flex items-center px-4 pb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
      <span className="flex-1">FG  PC  PS  A  CS  POTM  Caps</span>
      <span className="w-12 text-center">Cards</span>
    </div>
  )
}

// Sort: user's row first, then by position (GK > DEF > MID > FWD), then alphabetical
const SORT_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

function playerSortKey(player: RosterPlayer, myPlayerId: string | null): string {
  const positions = player.position ?? []
  // Use the highest-priority position (lowest sort order)
  const minPos = positions.length > 0
    ? Math.min(...positions.map((p) => SORT_ORDER[p] ?? 9))
    : 9
  return `${minPos}_${player.full_name.toLowerCase()}`
}

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
  const sorted = [...players].sort((a, b) => {
    // User's row always first
    if (a.id === myPlayerId && b.id !== myPlayerId) return -1
    if (b.id === myPlayerId && a.id !== myPlayerId) return 1
    // Then by position (GK > DEF > MID > FWD), then alphabetical
    return playerSortKey(a, myPlayerId).localeCompare(playerSortKey(b, myPlayerId))
  })

  return (
    <div className="space-y-2">
      {statsMap && <StatHeader />}
      {sorted.map((player) => {
        const isMe = player.id === myPlayerId
        const stats = statsMap?.get(player.id)
        const cardCls = `relative block w-full overflow-hidden rounded-xl px-4 py-3 text-left transition ${
          isMe ? 'bg-accent ring-1 ring-white/10' : 'border border-surface-border bg-surface-card'
        } ${!player.is_active ? 'opacity-50' : ''}`

        const inner = (
          <>
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

            {stats && (
              <div className="relative mt-1 flex items-end justify-between">
                <StatRow row={stats} isMe={isMe} positions={player.position} />
                <div className="shrink-0 pl-2">
                  <CardsCell row={stats} isMe={isMe} />
                </div>
              </div>
            )}
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
