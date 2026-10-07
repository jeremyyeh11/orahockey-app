'use client'

import type { LeaderboardRow } from './SeasonStats'
import type { AccountStatus } from '@/lib/account'

// Re-exported for client components that import them from here. Server
// components must import from '@/lib/account' — this is a client module.
export type { AccountStatus }
export { accountStatusOf } from '@/lib/account'

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


const POSITION_ORDER: Record<string, number> = { FWD: 0, MID: 1, DEF: 2, GK: 3 }

/** Default preferred name = first word of full_name, uppercased */
export function defaultPreferredName(fullName: string): string {
  return (fullName.trim().split(/\s+/)[0] ?? '').toUpperCase()
}

/** Effective preferred name: explicit override or default from full_name */
export function preferredName(player: { full_name: string; preferred_name: string | null }): string {
  return (player.preferred_name?.trim() || defaultPreferredName(player.full_name)).toUpperCase()
}

/** Splits a name into parts: before, preferred, after — keeping original word order.
 *  Returns separators so the renderer knows whether to insert a space between parts.
 *  Within-word splits (e.g. "ISH" in "ISHWARPAL") have no separator — the parts are joined directly. */
export function splitName(player: { full_name: string; preferred_name: string | null }): { before: string; beforeSep: string; preferred: string; afterSep: string; after: string } {
  const preferred = preferredName(player)
  const full = player.full_name.trim()
  const words = full.split(/\s+/)
  const prefWords = preferred.split(/\s+/)

  // First: try multi-word match (e.g. "PEH YU" in "PEH YU TAY")
  if (prefWords.length > 1) {
    for (let i = 0; i <= words.length - prefWords.length; i++) {
      const slice = words.slice(i, i + prefWords.length)
      if (slice.every((w, j) => w.toUpperCase() === prefWords[j].toUpperCase())) {
        return {
          before: words.slice(0, i).join(' ').toUpperCase(),
          beforeSep: ' ',
          preferred,
          afterSep: ' ',
          after: words.slice(i + prefWords.length).join(' ').toUpperCase(),
        }
      }
    }
  }

  // Second: try exact whole-word match (case-insensitive, single word)
  const wordIdx = words.findIndex(w => w.toUpperCase() === preferred.toUpperCase())
  if (wordIdx !== -1) {
    return {
      before: words.slice(0, wordIdx).join(' ').toUpperCase(),
      beforeSep: ' ',
      preferred,
      afterSep: ' ',
      after: words.slice(wordIdx + 1).join(' ').toUpperCase(),
    }
  }

  // Third: try substring match within a word (e.g. "KEAEN" in "KEAEN-SETH", "ISH" in "ISHWARPAL")
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toUpperCase()
    const p = preferred.toUpperCase()
    const pos = w.indexOf(p)
    if (pos !== -1) {
      const beforeWord = words.slice(0, i).join(' ')
      const wordBefore = words[i].slice(0, pos)
      const wordAfter = words[i].slice(pos + p.length)
      const afterParts = [wordAfter, ...words.slice(i + 1)].filter(s => s.length > 0)
      // Determine separators based on whether the split is within the same word
      // If wordBefore is non-empty, it's part of the same word — no separator
      const beforeText = [beforeWord, wordBefore].filter(s => s.length > 0).join(' ').toUpperCase()
      const beforeSep = wordBefore.length > 0 ? '' : ' '
      // If wordAfter is non-empty, it's part of the same word — no separator
      const afterText = afterParts.join(' ').toUpperCase()
      const afterSep = wordAfter.length > 0 ? '' : ' '
      return { before: beforeText, beforeSep, preferred, afterSep, after: afterText }
    }
  }

  // Not found at all — show full name with preferred prepended
  return { before: '', beforeSep: '', preferred, afterSep: ' ', after: full.toUpperCase() }
}

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
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs tabular-nums">
      {shapes[color]}
      <span className="text-slate-400">{count}</span>
    </span>
  )
}


export function CardsCell({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
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

const STAT_COLS = ['FG', 'PC', 'PS', 'A', 'CS', 'POTM', 'App'] as const

export function statValue(row: LeaderboardRow, col: string): number {
  switch (col) {
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

/** Stat columns that apply to a player's positions. */
export function statColumns(positions: string[] | null): string[] {
  const isGK = positions?.includes('GK') ?? false
  const isOutfield = positions?.some((p) => p !== 'GK') ?? false

  // GK-only: show CS, hide FG/PC/PS/A
  // Outfield-only: show FG/PC/PS/A, hide CS
  // Both (GK + outfield): show everything
  const cols: string[] = []
  if (isOutfield) cols.push('FG', 'PC', 'PS', 'A')
  if (isGK) cols.push('CS')
  cols.push('POTM', 'APP')
  return cols
}

function StatRow({ row, isMe, positions }: { row: LeaderboardRow; isMe: boolean; positions: string[] | null }) {
  const valCls = (v: number) =>
    v > 0 ? (isMe ? 'text-white' : 'text-white') : 'text-slate-600'
  const labelCls = isMe ? 'text-white/50' : 'text-slate-500'
  const cols = statColumns(positions)

  return (
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
  )
}

// Sort: user's row first, then alphabetical

export default function RosterList<T extends RosterPlayer>({
  players,
  myPlayerId,
  onSelect,
  statsMap,
  accountMap,
}: {
  players: T[]
  myPlayerId: string | null
  onSelect?: (player: T) => void
  statsMap?: Map<string, LeaderboardRow>
  /** Admin view only: player id → login-account status dot */
  accountMap?: Map<string, AccountStatus>
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
                {(() => {
                  const { before, beforeSep, preferred, afterSep, after } = splitName(player)
                  return (
                    <>
                      {before && <span className="text-sm font-normal tracking-wide text-slate-400">{before}{beforeSep}</span>}
                      <span>{preferred}</span>
                      {after && <span className="text-sm font-normal tracking-wide text-slate-400">{afterSep}{after}</span>}
                    </>
                  )
                })()}
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
                <StatRow row={stats} isMe={isMe} positions={player.position} />
                <div className="liga-roster-sanctions liga-meta shrink-0">
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
