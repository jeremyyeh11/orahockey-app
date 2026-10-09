'use client'

import { useRouter } from 'next/navigation'
import RosterList from '@/components/RosterList'
import RosterTable from '@/components/RosterTable'
import { startNavigationProgress } from '@/components/NavigationProgress'
import {
  useSeasonStats,
  TopScorersCard,
  TopAssistsCard,
  type PlayerLite,
  type GameLite,
  type SeasonStat,
  type PotmRow,
  type AttendanceRow,
  type MatchCardRow,
} from '@/components/SeasonStats'
import type { RosterPlayer } from '@/components/RosterList'
import { recordedStats, records, seasonTitle, type Season } from '@/lib/season'

type Player = RosterPlayer & PlayerLite

export default function SquadClient({
  season,
  players,
  games,
  stats,
  potm,
  attendance,
  cards,
  myPlayerId,
}: {
  season: Season
  /** The season's squad (season_players), with that season's jersey numbers */
  players: Player[]
  games: GameLite[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  cards: MatchCardRow[]
  myPlayerId: string | null
}) {
  const router = useRouter()
  const { topScorerGroups, topAssistGroups, statsMap } = useSeasonStats({
    season,
    players,
    games,
    stats,
    potm,
    attendance,
    cards,
  })

  // A past season shows everyone who was in that squad; an open one, who's active now
  const visible = season.locked ? players : players.filter((p) => p.is_active)
  const rosterProps = {
    players: visible,
    myPlayerId,
    onSelect: (p: Player) => {
      startNavigationProgress()
      router.push(`/dashboard/team/${p.id}`, { scroll: false })
    },
    statsMap,
    recorded: recordedStats(season),
  }

  return (
    <div className="liga-page p-4">
      <div className="liga-page-header mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="liga-page-title text-white">Squad</h1>
          <p className="liga-meta text-xs text-slate-400">
            {seasonTitle(season)} · {visible.length} players
          </p>
        </div>
      </div>

      {/* Top Scorers + Top Assists: side by side, stacked in a sticky side column next to the roster table at xl+ */}
      <div className="liga-squad-layout xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-6">
        <aside className="mb-4 grid grid-cols-2 items-start gap-3 xl:sticky xl:top-24 xl:order-last xl:mb-0 xl:grid-cols-1">
          {records(season, 'goals') && <TopScorersCard groups={topScorerGroups} />}
          {records(season, 'assists') && <TopAssistsCard groups={topAssistGroups} />}
          {(!records(season, 'goals') || !records(season, 'assists')) && (
            <div
              className={`liga-panel liga-stats-not-recorded card px-3 py-3 text-xs text-slate-400 ${
                records(season, 'goals') ? '' : 'col-span-2 xl:col-span-1'
              }`}
            >
              {records(season, 'goals')
                ? `Assists, goal types and cards weren't recorded for ${season.label}.`
                : `Stats not recorded for ${season.label} — only appearances (Apps) and results were kept.`}
            </div>
          )}
        </aside>

        {/* Cards on touch layouts, a sortable table on desktop */}
        <div className="min-w-0">
          {visible.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No players in this season&apos;s squad yet.</p>
          ) : (
            <>
              <div className="lg:hidden">
                <RosterList {...rosterProps} />
              </div>
              <div className="hidden lg:block">
                <RosterTable {...rosterProps} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
