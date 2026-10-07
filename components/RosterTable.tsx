'use client'

import { useState } from 'react'
import type { LeaderboardRow } from './SeasonStats'
import {
  ACCOUNT_DOT,
  CardsCell,
  sortPositions,
  nameParts,
  statColumns,
  statValue,
  type AccountStatus,
  type RosterPlayer,
} from './RosterList'

const STATS = [
  { key: 'FG', title: 'Field goals' },
  { key: 'PC', title: 'Penalty corner goals' },
  { key: 'PS', title: 'Penalty stroke goals' },
  { key: 'A', title: 'Assists' },
  { key: 'CS', title: 'Clean sheets (keepers)' },
  { key: 'POTM', title: 'Player of the Match wins' },
  { key: 'APP', title: 'Appearances' },
] as const

type SortKey = 'name' | 'number' | (typeof STATS)[number]['key']
type Sort = { key: SortKey; desc: boolean }

/**
 * Desktop (lg+) Squad roster: one row per player with each stat in its own
 * sortable column, so players compare down a column instead of across a card.
 * Touch layouts use the RosterList cards; props match RosterList.
 */
export default function RosterTable<T extends RosterPlayer>({
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
  /** Admin view only: player id → login-account status */
  accountMap?: Map<string, AccountStatus>
}) {
  const [sort, setSort] = useState<Sort>({ key: 'name', desc: false })

  // -1 = doesn't apply (e.g. CS for outfielders, no jersey number): always sorted last
  const valueOf = (p: T, key: SortKey): number => {
    if (key === 'number') return p.jersey_number ?? -1
    const row = statsMap?.get(p.id)
    if (!row || !statColumns(p.position).includes(key)) return -1
    return statValue(row, key)
  }
  const byName = (a: T, b: T) => a.full_name.toLowerCase().localeCompare(b.full_name.toLowerCase())

  const rows = [...players].sort((a, b) => {
    if (sort.key === 'name') {
      // Default A–Z matches the cards: your own row first
      if (!sort.desc && a.id === myPlayerId) return -1
      if (!sort.desc && b.id === myPlayerId) return 1
      return sort.desc ? byName(b, a) : byName(a, b)
    }
    const va = valueOf(a, sort.key)
    const vb = valueOf(b, sort.key)
    if (va < 0 !== vb < 0) return va < 0 ? 1 : -1
    return (sort.desc ? vb - va : va - vb) || byName(a, b)
  })

  // Stats start biggest-first; name and number start ascending
  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'number' }))
  }

  const header = (key: SortKey, label: string, title: string, align: 'left' | 'right') => {
    const active = sort.key === key
    return (
      <th
        key={key}
        scope="col"
        aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined}
        className={`px-2 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          onClick={() => sortBy(key)}
          title={title}
          className={`inline-flex min-h-[32px] items-center gap-1 uppercase tracking-wide transition hover:text-white ${
            active ? 'text-white' : ''
          }`}
        >
          {label}
          <span aria-hidden className={active ? '' : 'invisible'}>
            {sort.desc ? '↓' : '↑'}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="liga-roster-table overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="liga-meta border-b border-surface-border text-xs text-slate-400">
          <tr>
            {header('number', '#', 'Jersey number', 'right')}
            {header('name', 'Player', 'Name', 'left')}
            <th scope="col" className="px-2 py-2 text-left font-medium uppercase tracking-wide">
              Pos
            </th>
            {STATS.map((s) => header(s.key, s.key, s.title, 'right'))}
            <th scope="col" className="px-2 py-2 text-left font-medium uppercase tracking-wide">
              Cards
            </th>
            {accountMap && (
              <th scope="col" className="px-2 py-2 text-center font-medium uppercase tracking-wide">
                <span title="Login account">Acct</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const isMe = p.id === myPlayerId
            const row = statsMap?.get(p.id)
            const applies = statColumns(p.position)
            const account = accountMap?.get(p.id)
            const name = (
              <>
                {nameParts(p).map((part, i) => (
                  <span key={i} className={part.highlight ? 'font-semibold text-white' : 'font-normal text-slate-400'}>
                    {part.text}
                  </span>
                ))}
                {isMe && <span className="sr-only"> (you)</span>}
              </>
            )
            return (
              <tr
                key={p.id}
                onClick={onSelect ? () => onSelect(p) : undefined}
                className={`liga-roster-row border-b border-surface-border transition-colors ${
                  onSelect ? 'cursor-pointer hover:bg-white/[0.04]' : ''
                } ${isMe ? 'bg-brand/15' : ''} ${!p.is_active ? 'opacity-50' : ''}`}
              >
                <td className="liga-meta px-2 py-3 text-right tabular-nums text-slate-400">
                  {p.jersey_number ?? ''}
                </td>
                <th scope="row" className="px-2 py-3 text-left font-normal">
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(p)
                      }}
                      className="text-left hover:underline"
                    >
                      {name}
                    </button>
                  ) : (
                    name
                  )}
                </th>
                <td className="liga-meta whitespace-nowrap px-2 py-3 text-xs text-slate-300">
                  {sortPositions(p.position).join(' ')}
                </td>
                {STATS.map((s) => {
                  // Blank = doesn't apply to this player's positions; – = none yet
                  if (!applies.includes(s.key)) return <td key={s.key} className="px-2 py-3" />
                  const v = row ? statValue(row, s.key) : 0
                  return (
                    <td
                      key={s.key}
                      className={`px-2 py-3 text-right tabular-nums ${v > 0 ? 'font-medium text-white' : 'text-slate-500'}`}
                    >
                      {v > 0 ? v : '–'}
                    </td>
                  )
                })}
                <td className="liga-meta px-2 py-3">{row && <CardsCell row={row} isMe={isMe} />}</td>
                {accountMap && (
                  <td className="px-2 py-3 text-center">
                    {account && (
                      <span
                        title={ACCOUNT_DOT[account].title}
                        className={`inline-block h-2 w-2 rounded-full ${ACCOUNT_DOT[account].cls}`}
                      >
                        <span className="sr-only">{ACCOUNT_DOT[account].title}</span>
                      </span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
