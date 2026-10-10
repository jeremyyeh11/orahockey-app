'use client'

import type { LeaderboardRow } from './SeasonStats'
import type { AccountStatus } from '@/lib/account'
import { sortPositions } from '@/lib/constants'
import { nameParts } from '@/lib/names'

export type RosterPlayer = {
  id: string
  full_name: string
  preferred_name: string | null
  jersey_number: number | null
  position: string[] | null
  is_active: boolean
}

/** Login-account state shown as a dot on admin roster cards */
export const ACCOUNT_DOT: Record<AccountStatus, { cls: string; title: string }> = {
  active: { cls: 'bg-green-400', title: 'Account active' },
  invited: { cls: 'bg-amber-400', title: 'Invited — not claimed yet' },
  none: { cls: 'bg-slate-500', title: 'No account yet' },
  // Hollow dot: added before onboarding, no email to invite yet
  pending: { cls: 'border border-slate-400 bg-transparent', title: 'Pending — no email yet' },
}


function CardShape({ color, count }: { color: 'green' | 'yellow' | 'red'; count: number }) {
  if (count === 0) return null
  const shapes = {
    green: <span className="text-green-400">▲</span>,
    yellow: <span className="text-yellow-400">■</span>,
    red: <span className="text-red-400">●</span>,
  }
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs tabular-nums">
      {shapes[color]}
      <span className="text-slate-400">{count}</span>
    </span>
  )
}


export function CardsCell({ row }: { row: LeaderboardRow }) {
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

const ALL_RECORDED = ['goals', 'goal_types', 'assists', 'cards', 'potm']

export function statValue(row: LeaderboardRow, col: string): number {
  switch (col) {
    case 'G': return row.goals
    case 'FG': return row.fg
    case 'PC': return row.pc
    case 'PS': return row.ps
    case 'A': return row.assists
    case 'CS': return row.cleanSheets
    case 'POTM': return row.potmWins
    case 'APP': return row.caps
    default: return 0
  }
}

// No positions set (e.g. past players imported from caps sheets): treat as outfield so goals still show
const isOutfieldOf = (positions: string[] | null) => !positions?.length || positions.some((p) => p !== 'GK')

/**
 * Headline stat columns for a player's positions and what the season recorded
 * (`recorded`, see lib/season): G (goals), A, CS (keepers), POTM, APP — each
 * only where it applies / was recorded. The goal-type breakdown is separate and
 * quieter: goalTypeColumns.
 */
export function statColumns(positions: string[] | null, recorded: readonly string[] = ALL_RECORDED): string[] {
  const isGK = positions?.includes('GK') ?? false
  const has = (s: string) => recorded.includes(s)

  // GK-only: CS, no goals/A. Outfield-only: goals/A, no CS. Both: everything.
  const cols: string[] = []
  if (isOutfieldOf(positions)) {
    if (has('goals')) cols.push('G')
    if (has('assists')) cols.push('A')
  }
  if (isGK) cols.push('CS')
  if (has('potm')) cols.push('POTM')
  cols.push('APP')
  return cols
}

/** FG / PC / PS — the breakdown of G, shown as a lower tier; none where goal types weren't recorded */
export function goalTypeColumns(positions: string[] | null, recorded: readonly string[] = ALL_RECORDED): string[] {
  return isOutfieldOf(positions) && recorded.includes('goal_types') ? ['FG', 'PC', 'PS'] : []
}

function StatRow({
  row,
  isMe,
  positions,
  recorded,
}: {
  row: LeaderboardRow
  isMe: boolean
  positions: string[] | null
  recorded?: readonly string[]
}) {
  const valCls = (v: number) =>
    v > 0 ? (isMe ? 'text-white' : 'text-white') : 'text-slate-600'
  const labelCls = isMe ? 'text-white/50' : 'text-slate-500'
  const cols = statColumns(positions, recorded)
  // Goal types as a quiet second line — only the ones they scored
  const types = goalTypeColumns(positions, recorded).filter((c) => statValue(row, c) > 0)

  return (
    <div className="min-w-0 flex-1">
    <div className="liga-roster-stats liga-meta min-w-0 flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 mt-1.5 text-xs tabular-nums">
      {cols.map((col) => {
        const v = statValue(row, col)
        return (
          <span key={col} className="liga-roster-stat inline-flex shrink-0 items-baseline gap-0.5 whitespace-nowrap">
            <span className={`font-medium ${valCls(v)}`}>{v > 0 ? v : '–'}</span>
            <span className={labelCls}>{col}</span>
          </span>
        )
      })}
    </div>
    {types.length > 0 && (
      <div className="liga-roster-goal-types liga-meta mt-0.5 text-[11px] tabular-nums text-slate-500">
        {types.map((c) => `${statValue(row, c)} ${c}`).join(' · ')}
      </div>
    )}
    </div>
  )
}

// Sort: user's row first, then alphabetical

export default function RosterList<T extends RosterPlayer>({
  players,
  myPlayerId,
  onSelect,
  statsMap,
  accountMap,
  recorded,
}: {
  players: T[]
  myPlayerId: string | null
  onSelect?: (player: T) => void
  statsMap?: Map<string, LeaderboardRow>
  /** Admin view only: player id → login-account status dot */
  accountMap?: Map<string, AccountStatus>
  /** What the season recorded (lib/season recordedStats) — picks the stat columns */
  recorded?: readonly string[]
}) {
  const sorted = [...players].sort((a, b) => {
    // User's row always first
    if (a.id === myPlayerId && b.id !== myPlayerId) return -1
    if (b.id === myPlayerId && a.id !== myPlayerId) return 1
    // Then alphabetical
    return a.full_name.toLowerCase().localeCompare(b.full_name.toLowerCase())
  })

  return (
    <div className="liga-roster-list space-y-2">
      {sorted.map((player) => {
        const isMe = player.id === myPlayerId
        const stats = statsMap?.get(player.id)
        const account = accountMap?.get(player.id)
        const cardCls = `liga-roster-card relative block w-full overflow-hidden rounded-lg px-4 py-3 text-left transition ${
          isMe ? 'bg-accent ring-1 ring-white/10' : 'border border-surface-border bg-surface-card'
        } ${!player.is_active ? 'opacity-50' : ''}`

        const inner = (
          <>
            {player.jersey_number != null && (
              <span
                aria-hidden
                className="liga-roster-number liga-meta pointer-events-none absolute right-8 top-3 select-none text-xs tabular-nums text-white"
              >
                {player.jersey_number}
              </span>
            )}

            {account && (
              <span
                title={ACCOUNT_DOT[account].title}
                className={`liga-account-dot absolute right-3 top-3.5 h-2 w-2 rounded-full ${ACCOUNT_DOT[account].cls}`}
              />
            )}

            <div className="relative min-w-0 pr-12">
              <div className="liga-roster-name break-words font-medium leading-snug text-white">
                {nameParts(player).map((part, i) =>
                  part.highlight ? (
                    <span key={i}>{part.text}</span>
                  ) : (
                    <span key={i} className="text-sm font-normal tracking-wide text-slate-400">{part.text}</span>
                  )
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {sortPositions(player.position).map((pos) => (
                  <span
                    key={pos}
                    className={`liga-roster-position text-xs font-medium ${
                      isMe ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {pos}
                  </span>
                ))}
              </div>
            </div>

            {stats && (
              <div className="liga-roster-details relative mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                <StatRow row={stats} isMe={isMe} positions={player.position} recorded={recorded} />
                <div className="liga-roster-sanctions liga-meta shrink-0">
                  <CardsCell row={stats} />
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
