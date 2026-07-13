'use client'

import { preferredName } from './RosterList'

// Re-export types and pure functions from lib/stats.ts so existing imports work
export type { PlayerLite, GameLite, SeasonStat, PotmRow, AttendanceRow, MatchCardRow, LeaderboardRow } from '@/lib/stats'
export { computeSeason, seasonsOf } from '@/lib/stats'

import type { LeaderboardRow } from '@/lib/stats'

export function SeasonSelect({
  seasons,
  value,
  onChange,
}: {
  seasons: string[]
  value: string
  onChange: (s: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {seasons.map((s) => (
        <option key={s} value={s}>
          MHL1 {s}
        </option>
      ))}
    </select>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

export function PotsCard({ pots }: { pots: LeaderboardRow[] }) {
  if (pots.length === 0) return null
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        POTS Race
      </div>
      {pots.map((r, i) => (
        <div
          key={r.player.id}
          className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0"
        >
          <span className="w-5 text-center text-sm">{MEDALS[i]}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
            {preferredName(r.player)}
          </span>
          <span className="shrink-0 text-xs font-semibold text-brand-light">{r.potsPts} pts</span>
        </div>
      ))}
    </div>
  )
}

export function TopScorersCard({ groups }: { groups: LeaderboardRow[][] }) {
  if (groups.length === 0) return null
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Top Scorers
      </div>
      {groups.map((grp, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0"
        >
          <span className="w-5 text-center text-sm">{MEDALS[i]}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
            {grp.map((r) => preferredName(r.player)).join(' / ')}
          </span>
          <span className="shrink-0 text-xs font-semibold text-brand-light">{grp[0].goals}</span>
        </div>
      ))}
    </div>
  )
}

export function LeaderboardTable({
  rows,
  highlightId,
}: {
  rows: LeaderboardRow[]
  highlightId?: string | null
}) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="py-6 text-center text-sm text-slate-500">No stats recorded yet.</p>
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
            <th className="px-2 py-2.5 font-medium">Player</th>
            <th className="px-1.5 py-2.5 text-center font-medium">FG</th>
            <th className="px-1.5 py-2.5 text-center font-medium">PC</th>
            <th className="px-1.5 py-2.5 text-center font-medium">PS</th>
            <th className="px-1.5 py-2.5 text-center font-medium">A</th>
            <th className="px-1.5 py-2.5 text-center font-medium">CS</th>
            <th className="px-1.5 py-2.5 text-center font-medium">POTM</th>
            <th className="py-2.5 pl-1.5 pr-4 text-center font-medium">Caps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.player.id}
              className={`border-b border-white/5 last:border-0 ${
                highlightId && row.player.id === highlightId ? 'bg-brand/10' : ''
              }`}
            >
              <td className="py-2.5 pl-4 pr-2 text-slate-500">{i + 1}</td>
              <td className="max-w-0 truncate px-2 py-2.5">
                <div className="truncate font-medium text-white">{row.player.full_name}</div>
              </td>
              <td className="px-1.5 py-2.5 text-center font-semibold text-white">
                {row.fg > 0 ? row.fg : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.pc > 0 ? row.pc : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.ps > 0 ? row.ps : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.assists > 0 ? row.assists : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.cleanSheets > 0 ? row.cleanSheets : '—'}
              </td>
              <td className="px-1.5 py-2.5 text-center text-slate-300">
                {row.potmWins > 0 ? row.potmWins : '—'}
              </td>
              <td className="py-2.5 pl-1.5 pr-4 text-center text-slate-300">{row.caps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
