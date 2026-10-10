'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPlayer } from '@/app/admin/team/actions'
import RosterList from '@/components/RosterList'
import RosterTable from '@/components/RosterTable'
import { startNavigationProgress } from '@/components/NavigationProgress'
import Modal from '@/components/Modal'
import ExistingPlayerPicker, { type OutsidePlayer } from '@/app/admin/team/ExistingPlayerPicker'
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
import { accountStatusOf, type AccountStatus } from '@/lib/account'
import { LEAGUE } from '@/lib/constants'
import { recordedStats, records, seasonTitle, type Season } from '@/lib/season'
import { FormButtons, FormError, PositionPicker, inputCls, labelCls } from '@/components/form'
import { unwrap } from '@/lib/action-result'

/** A squad member; the account fields are only loaded for admins */
export type SquadPlayer = RosterPlayer & PlayerLite & {
  /** null = pending: added before onboarding, no email yet */
  email?: string | null
  role?: 'player' | 'admin'
  auth_user_id?: string | null
}

export type WhitelistRow = { email: string; invited_at: string | null; claimed_at: string | null }

type NewPlayer = {
  full_name: string
  preferred_name: string | null
  email: string | null
  jersey_number: number | null
  position: string[] | null
  role: 'player' | 'admin'
}

/**
 * The Squad tab for both areas (SquadView loads it): Top Scorers / Top Assists
 * and the roster (cards on touch layouts, a sortable table on desktop). Admins
 * also get account dots, Show inactive, + Add Player and + Existing Player.
 */
export default function SquadClient({
  basePath,
  season,
  players,
  games,
  stats,
  potm,
  attendance,
  cards,
  myPlayerId,
  whitelist = [],
  notInSquad = [],
}: {
  basePath: '/dashboard' | '/admin'
  season: Season
  /** The season's squad (season_players), with that season's jersey numbers */
  players: SquadPlayer[]
  games: GameLite[]
  stats: SeasonStat[]
  potm: PotmRow[]
  attendance: AttendanceRow[]
  cards: MatchCardRow[]
  myPlayerId: string | null
  /** Admins: invites, for the account dots */
  whitelist?: WhitelistRow[]
  /** Admins: players on the books who aren't in this season's squad (for "+ Existing Player") */
  notInSquad?: OutsidePlayer[]
}) {
  const isAdmin = basePath === '/admin'
  const router = useRouter()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showExisting, setShowExisting] = useState(false)
  // Add Player: join this season's squad (default) or add a past player, inactive and in no season
  const [joinSeason, setJoinSeason] = useState(true)
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { topScorerGroups, topAssistGroups, statsMap } = useSeasonStats({
    season,
    players,
    games,
    stats,
    potm,
    attendance,
    cards,
  })

  // Account status per player (admins): green = signed in before, amber = invited
  // but not claimed, grey = no account yet, hollow = pending (no email yet)
  let accountMap: Map<string, AccountStatus> | undefined
  if (isAdmin) {
    const wlByEmail = new Map(whitelist.map((w) => [w.email, w]))
    accountMap = new Map(
      players.map((p) => [
        p.id,
        accountStatusOf({ email: p.email ?? null, auth_user_id: p.auth_user_id ?? null }, p.email ? wlByEmail.get(p.email)?.invited_at : null),
      ])
    )
  }

  // A past (locked) season shows its whole squad, read-only; an open one, who's active now
  const visible = season.locked || showInactive ? players : players.filter((p) => p.is_active)
  const rosterProps = {
    players: visible,
    myPlayerId,
    onSelect: (p: SquadPlayer) => {
      startNavigationProgress()
      router.push(`${basePath}/team/${p.id}`, { scroll: false })
    },
    statsMap,
    recorded: recordedStats(season),
    accountMap,
  }

  function openAdd() {
    setSelectedPositions([])
    setJoinSeason(true)
    setError(null)
    setShowAddModal(true)
  }

  function parseForm(form: HTMLFormElement): NewPlayer {
    const fd = new FormData(form)
    const jerseyRaw = fd.get('jersey_number') as string
    const preferredRaw = (fd.get('preferred_name') as string).trim()
    return {
      full_name: fd.get('full_name') as string,
      preferred_name: preferredRaw ? preferredRaw.toUpperCase() : null,
      email: ((fd.get('email') as string) ?? '').trim() || null,
      jersey_number: jerseyRaw ? Number(jerseyRaw) : null,
      position: selectedPositions.length > 0 ? selectedPositions : null,
      role: fd.get('role') as 'player' | 'admin',
    }
  }

  function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = parseForm(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await unwrap(addPlayer(data, joinSeason))
        setShowAddModal(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="liga-page p-4">
      {/* Header + add player (admins, open seasons only) */}
      <div className="liga-page-header mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="liga-page-title text-white">Squad</h1>
          <p className="liga-meta text-xs text-slate-400">
            {seasonTitle(season)} · {visible.length} players
          </p>
        </div>
        {isAdmin && !season.locked && (
          <div className="liga-squad-actions flex min-w-0 flex-wrap items-center gap-2">
            <button
              onClick={openAdd}
              className="liga-button liga-button-primary min-h-[44px] bg-accent rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-brand"
            >
              + Add Player
            </button>
            {notInSquad.length > 0 && (
              <button
                onClick={() => setShowExisting(true)}
                className="liga-button liga-button-secondary min-h-[44px] rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-brand"
              >
                + Existing Player
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top Scorers + Top Assists: side by side, stacked in a sticky side column next to the roster table at xl+ */}
      <div className="liga-squad-layout xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-6">
        <aside className="liga-squad-summaries mb-4 grid grid-cols-2 items-start gap-3 xl:sticky xl:top-24 xl:order-last xl:mb-0 xl:grid-cols-1">
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

        <div className="min-w-0">
          {isAdmin && !season.locked && players.some((p) => !p.is_active) && (
            <label className="liga-inactive-toggle liga-meta flex min-h-[44px] items-center gap-2 text-xs text-slate-400 mb-4 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded accent-brand"
              />
              Show inactive
            </label>
          )}

          {visible.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              {isAdmin ? 'No players yet. Add one above.' : "No players in this season's squad yet."}
            </p>
          ) : (
            <>
              {/* Cards on touch layouts, a sortable table on desktop */}
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

      {/* Add existing players to this season (returning players) */}
      {showExisting && (
        <ExistingPlayerPicker seasonLabel={season.label} players={notInSquad} onClose={() => setShowExisting(false)} />
      )}

      {/* Add Player modal (separate from profile) */}
      {showAddModal && (
        <Modal onClose={() => { setShowAddModal(false); setError(null) }}>
          <h2 className="text-lg font-bold text-white mb-5">Add Player</h2>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input name="full_name" type="text" required className={inputCls} placeholder="John Smith" />
            </div>
            <div>
              <label className={labelCls}>Preferred Name</label>
              <input name="preferred_name" type="text" className={inputCls} placeholder="Auto (first name)" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input name="email" type="email" className={inputCls} placeholder="player@example.com" />
              <p className="mt-1 text-[11px] text-slate-500">
                Optional — leave blank if you don&apos;t have it yet. It&apos;s their login, so it&apos;s needed before you can send an invite link.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Jersey #</label>
                <input name="jersey_number" type="number" min="0" max="99" className={inputCls} placeholder="—" />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Position</label>
                <PositionPicker value={selectedPositions} onChange={setSelectedPositions} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select name="role" className={inputCls} defaultValue="player">
                <option value="player">Player</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <label className="liga-join-season flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-surface-border px-3 py-2.5">
              <input
                type="checkbox"
                checked={joinSeason}
                onChange={(e) => setJoinSeason(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-brand"
              />
              <span className="text-sm text-white">
                Add to the {LEAGUE} {season.label} squad
                <span className="block text-[11px] text-slate-500">
                  Untick for a past player: they&apos;re added as inactive and in no season.
                </span>
              </span>
            </label>
            <FormError error={error} />
            <FormButtons isPending={isPending} onCancel={() => { setShowAddModal(false); setError(null) }} />
          </form>
        </Modal>
      )}
    </div>
  )
}
