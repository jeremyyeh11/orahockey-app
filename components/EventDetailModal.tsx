'use client'

import { useState } from 'react'
import { ReadEditModal } from './ReadEditModal'
import { preferredName } from './RosterList'
import { fmtDateTime, dateBlock, toDatetimeLocal, fromDatetimeLocal } from '@/lib/format'
import type { GameInput, TrainingInput } from '@/app/admin/schedule/actions'
import { setAttendance } from '@/app/dashboard/schedule/actions'
import { TeamListModal } from './TeamListModal'
import { MatchResultModal, type PotmPlacing } from './MatchResultModal'
import type { GoalRow, CardRow } from '@/app/dashboard/schedule/resultActions'

export type Game = {
  id: string
  opponent: string
  game_date: string
  location: string | null
  home_away: 'home' | 'away' | null
  game_type: 'regular' | 'playoff' | 'exhibition'
  goals_for: number | null
  goals_against: number | null
  result: string | null
  notes: string | null
  team_list_status: 'draft' | 'published' | null
}

export type Training = {
  id: string
  session_date: string
  location: string | null
  notes: string | null
}

export type PlayerLite = {
  id: string
  full_name: string
  preferred_name: string | null
  position?: string[] | null
  jersey_number?: number | null
}

export type AttendanceRow = {
  player_id: string
  session_id: string
  status: 'attending' | 'not_attending' | 'maybe'
  player: { full_name: string; preferred_name: string | null }
}

type EventItem =
  | { kind: 'game'; date: string; game: Game }
  | { kind: 'training'; date: string; training: Training }

type MyStatus = 'attending' | 'not_attending' | 'maybe'

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  win: { label: 'W', cls: 'bg-green-900/60 text-green-300' },
  loss: { label: 'L', cls: 'bg-red-900/60 text-red-300' },
  tie: { label: 'D', cls: 'bg-slate-700 text-slate-300' },
  ot_win: { label: 'W·OT', cls: 'bg-green-900/60 text-green-300' },
  ot_loss: { label: 'L·OT', cls: 'bg-red-900/60 text-red-300' },
}

const inputCls =
  'w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

type BreakdownGroup = { label: string; players: string[] }

function buildBreakdown(
  attendance: AttendanceRow[] | undefined,
  roster: PlayerLite[],
  myPlayerId: string
): BreakdownGroup[] {
  const groups: Record<string, PlayerLite[]> = {
    attending: [],
    maybe: [],
    not_attending: [],
  }
  const respondedIds = new Set<string>()

  for (const a of attendance ?? []) {
    const p: PlayerLite = {
      id: a.player_id,
      full_name: a.player.full_name,
      preferred_name: a.player.preferred_name,
    }
    if (groups[a.status]) groups[a.status].push(p)
    respondedIds.add(a.player_id)
  }

  const noResponse = roster.filter((p) => !respondedIds.has(p.id))

  return [
    { label: 'Attending', players: groups.attending.map((p) => preferredName(p)) },
    { label: 'Maybe', players: groups.maybe.map((p) => preferredName(p)) },
    { label: 'Not attending', players: groups.not_attending.map((p) => preferredName(p)) },
    { label: "Hasn't responded", players: noResponse.map((p) => preferredName(p)) },
  ].filter((g) => g.players.length > 0)
}

export function EventDetailModal({
  item,
  isAdmin,
  teamListByGame,
  myStatus,
  attendanceBySession,
  roster,
  myPlayerId,
  now,
  goalsByGame,
  cardsByGame,
  potmByGame,
  onClose,
  onSaveGame,
  onSaveTraining,
  onDelete,
  isPending,
}: {
  item: EventItem | null
  isAdmin: boolean
  teamListByGame: Record<string, Record<string, boolean>>
  myStatus: MyStatus | undefined
  attendanceBySession: Record<string, AttendanceRow[]>
  roster: PlayerLite[]
  myPlayerId: string
  now: string
  goalsByGame: Record<string, GoalRow[]>
  cardsByGame: Record<string, CardRow[]>
  potmByGame: Record<string, PotmPlacing[]>
  onClose: () => void
  onSaveGame: (id: string, data: GameInput) => void
  onSaveTraining: (id: string, data: TrainingInput) => void
  onDelete: () => void
  isPending: boolean
}) {
  const [editMode, setEditMode] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [showTeamList, setShowTeamList] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [localTeamListStatus, setLocalTeamListStatus] = useState<'draft' | 'published' | null>(
    item?.kind === 'game' ? item.game.team_list_status : null
  )
  // Local copies so the read view + a reopened result modal stay fresh without a refresh
  const [localScore, setLocalScore] = useState<{ gf: number; ga: number; result: string } | null>(null)
  const [localGoals, setLocalGoals] = useState<GoalRow[] | null>(null)
  const [localCards, setLocalCards] = useState<CardRow[] | null>(null)
  // Local copy of my attendance status so the UI updates live without refresh
  const [localMyStatus, setLocalMyStatus] = useState<MyStatus | undefined>(myStatus)

  if (!item) return null

  const currentItem = item
  const kind = currentItem.kind
  const isGame = kind === 'game'
  const sessionId = isGame ? currentItem.game.id : currentItem.training.id
  const dateStr = isGame ? currentItem.game.game_date : currentItem.training.session_date
  const location = isGame ? currentItem.game.location : currentItem.training.location
  const notes = isGame ? currentItem.game.notes : currentItem.training.notes

  const title = isGame ? `vs ${currentItem.game.opponent}` : 'Training'
  const breakdown = buildBreakdown(attendanceBySession[sessionId], roster, myPlayerId)

  // Update result — matches only, enabled once the match date/time has passed
  const hasStarted = new Date(dateStr).getTime() <= new Date(now).getTime()
  const effectiveScore = localScore ?? (
    isGame && currentItem.kind === 'game' && currentItem.game.result
      ? {
          gf: currentItem.game.goals_for ?? 0,
          ga: currentItem.game.goals_against ?? 0,
          result: currentItem.game.result,
        }
      : null
  )

  // Team list data — use local state so it updates without a page refresh
  const teamListStatus = isGame && currentItem.kind === 'game' ? localTeamListStatus : null
  const teamListSelections = teamListByGame[sessionId] ?? {}
  const isTeamListPublished = localTeamListStatus === 'published'

  // Get attending player IDs from attendance data
  const sessionAttendance = attendanceBySession[sessionId] ?? []
  const attendingPlayerIds = new Set(
    sessionAttendance
      .filter((a) => a.status === 'attending')
      .map((a) => a.player_id)
  )
  // If my local status changed, update the attending set
  if (localMyStatus === 'attending') attendingPlayerIds.add(myPlayerId)
  if (localMyStatus && localMyStatus !== 'attending') attendingPlayerIds.delete(myPlayerId)

  // Get selected players for published display — filtered by current attendance
  const selectedPlayers = roster
    .filter((p) => teamListSelections[p.id] === true && attendingPlayerIds.has(p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  function handleRespond(status: MyStatus) {
    setLocalMyStatus(status)
    setRespondingId(sessionId)
    setAttendance(sessionId, kind, status).finally(() => setRespondingId(null))
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (isGame) {
      const gf = fd.get('goals_for') as string
      const ga = fd.get('goals_against') as string
      const data: GameInput = {
        opponent: fd.get('opponent') as string,
        game_date: fromDatetimeLocal(fd.get('game_date') as string),
        location: (fd.get('location') as string) || null,
        home_away: (fd.get('home_away') as 'home' | 'away') || null,
        game_type: fd.get('game_type') as GameInput['game_type'],
        goals_for: gf === '' ? null : Number(gf),
        goals_against: ga === '' ? null : Number(ga),
        notes: (fd.get('notes') as string) || null,
      }
      onSaveGame(sessionId, data)
    } else {
      const data: TrainingInput = {
        session_date: fromDatetimeLocal(fd.get('session_date') as string),
        location: (fd.get('location') as string) || null,
        notes: (fd.get('notes') as string) || null,
      }
      onSaveTraining(sessionId, data)
    }
    setEditMode(false)
  }

  // If result entry modal is open, render it instead
  if (showResult && isGame && currentItem.kind === 'game') {
    const g = currentItem.game
    const gameWithScore = localScore
      ? { ...g, goals_for: localScore.gf, goals_against: localScore.ga, result: localScore.result }
      : g
    // Scorers/assists/cards come from the published match team list; full roster if not published
    const resultPlayers =
      isTeamListPublished && selectedPlayers.length > 0 ? selectedPlayers : roster
    return (
      <MatchResultModal
        game={gameWithScore}
        players={resultPlayers}
        roster={roster}
        initialGoals={localGoals ?? goalsByGame[sessionId] ?? []}
        initialCards={localCards ?? cardsByGame[sessionId] ?? []}
        potm={potmByGame[sessionId] ?? []}
        onClose={() => setShowResult(false)}
        onScoreChange={(gf, ga, result) => setLocalScore({ gf, ga, result })}
        onGoalsChange={setLocalGoals}
        onCardsChange={setLocalCards}
      />
    )
  }

  // If team list modal is open, render it instead
  if (showTeamList && isGame && currentItem.kind === 'game') {
    return (
      <TeamListModal
        game={currentItem.game}
        roster={roster as (PlayerLite & { position: string[] | null; jersey_number: number | null })[]}
        attendance={attendanceBySession[sessionId] ?? []}
        teamListStatus={localTeamListStatus}
        existingSelections={teamListSelections}
        onClose={() => setShowTeamList(false)}
        onStatusChange={(status) => setLocalTeamListStatus(status)}
      />
    )
  }

  return (
    <ReadEditModal
      title={title}
      titleAction={
        isGame && !editMode ? (
          <button
            type="button"
            onClick={() => setShowResult(true)}
            disabled={!hasStarted}
            className="shrink-0 rounded-lg border border-surface-border px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
          >
            Update result
          </button>
        ) : undefined
      }
      isOpen={!!item}
      onClose={onClose}
      isAdmin={isAdmin}
      editMode={editMode}
      onEnterEdit={() => setEditMode(true)}
      onSave={() => {
        const form = document.getElementById('event-edit-form') as HTMLFormElement | null
        form?.requestSubmit()
      }}
      onDiscard={() => setEditMode(false)}
      isPending={isPending}
      onDelete={isAdmin && editMode ? onDelete : undefined}
    >
      {/* READ MODE */}
      {!editMode && (
        <div className="space-y-5">
          {/* Event details */}
          <div className="space-y-2">
            <DetailRow label="Date & time" value={fmtDateTime(dateStr)} />
            {isGame && currentItem.kind === 'game' && (
              <>
                <DetailRow label="Opponent" value={currentItem.game.opponent} />
                <DetailRow label="Home / Away" value={currentItem.game.home_away ? (currentItem.game.home_away === 'home' ? 'Home' : 'Away') : '—'} />
                <DetailRow label="Type" value={currentItem.game.game_type.charAt(0).toUpperCase() + currentItem.game.game_type.slice(1)} />
                {effectiveScore && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Result</span>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${RESULT_BADGE[effectiveScore.result]?.cls ?? 'bg-slate-700 text-slate-300'}`}>
                        {RESULT_BADGE[effectiveScore.result]?.label ?? effectiveScore.result}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {effectiveScore.gf}–{effectiveScore.ga}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            <DetailRow label="Venue" value={location || 'TBD'} />
          </div>

          {/* Team List — published view (all users) or admin button */}
          {isGame && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Team List</h3>
              {isTeamListPublished ? (
                /* Published: show the selected players with jersey numbers */
                <div className="space-y-1">
                  {selectedPlayers.map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 rounded-lg px-2 py-1 ${p.id === myPlayerId ? 'bg-brand/15 ring-1 ring-brand/30' : ''}`}>
                      <span className="flex-1 text-sm text-white">{preferredName(p)}</span>
                      <span className="w-16 text-center text-[11px] text-slate-400">
                        {(p.position ?? []).join(' ') || '—'}
                      </span>
                      <span className="w-8 text-center text-sm font-semibold text-white">
                        {p.jersey_number ?? '—'}
                      </span>
                    </div>
                  ))}
                  {selectedPlayers.length === 0 && (
                    <p className="text-xs text-slate-500">No players selected.</p>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowTeamList(true)}
                      className="mt-2 w-full rounded-lg border border-surface-border py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                    >
                      Edit Team List
                    </button>
                  )}
                </div>
              ) : isAdmin ? (
                /* Admin: show Team List button */
                <button
                  type="button"
                  onClick={() => setShowTeamList(true)}
                  className="w-full rounded-lg border border-surface-border py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  {teamListStatus === 'draft' ? 'Edit Team List (Draft)' : 'Select Team List'}
                </button>
              ) : (
                /* Player: not published yet */
                <p className="text-xs text-slate-500">To be announced</p>
              )}
            </div>
          )}

          {/* Attendance voting */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Your attendance</h3>
            <div className="flex gap-2">
              {([
                ['attending', "I'm in"],
                ['maybe', 'Maybe'],
                ['not_attending', 'Out'],
              ] as const).map(([status, label]) => (
                <button
                  key={status}
                  onClick={() => handleRespond(status)}
                  disabled={respondingId === sessionId}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-40 ${
                    localMyStatus === status
                      ? status === 'attending'
                        ? 'bg-accent text-white ring-1 ring-white/10'
                        : status === 'maybe'
                        ? 'bg-amber-900/60 text-amber-300'
                        : 'bg-slate-700 text-slate-300'
                      : 'border border-surface-border text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Attendance breakdown */}
          {breakdown.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Attendance</h3>
              <div className="space-y-2">
                {breakdown.map((group) => (
                  <div key={group.label}>
                    <div className="mb-1 text-[11px] font-medium text-slate-500">
                      {group.label} ({group.players.length})
                    </div>
                    <div className="space-y-0.5">
                      {group.players.map((name) => (
                        <div key={name} className="text-[11px] text-slate-300">
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Information */}
          {notes && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Additional Information</h3>
              <p className="text-sm text-slate-300">{notes}</p>
            </div>
          )}
        </div>
      )}

      {/* EDIT MODE (admins only) */}
      {editMode && (
        <form id="event-edit-form" onSubmit={handleSave} className="space-y-4">
          {isGame && currentItem.kind === 'game' && (
            <>
              <div>
                <label className={labelCls}>Opponent *</label>
                <input name="opponent" type="text" required defaultValue={currentItem.game.opponent} className={inputCls} placeholder="Tornados" />
              </div>
              <div>
                <label className={labelCls}>Date &amp; time *</label>
                <input name="game_date" type="datetime-local" required defaultValue={toDatetimeLocal(currentItem.game.game_date)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input name="location" type="text" defaultValue={currentItem.game.location ?? ''} className={inputCls} placeholder="Sengkang Hockey Stadium" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Home / Away</label>
                  <select name="home_away" defaultValue={currentItem.game.home_away ?? ''} className={inputCls}>
                    <option value="">—</option>
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Type</label>
                  <select name="game_type" defaultValue={currentItem.game.game_type} className={inputCls}>
                    <option value="regular">Regular</option>
                    <option value="playoff">Playoff</option>
                    <option value="exhibition">Exhibition</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Score (leave blank if not played yet)</label>
                <div className="flex items-center gap-3">
                  <input name="goals_for" type="number" min="0" max="99" defaultValue={currentItem.game.goals_for ?? ''} className={inputCls} placeholder="Us" />
                  <span className="text-slate-500">–</span>
                  <input name="goals_against" type="number" min="0" max="99" defaultValue={currentItem.game.goals_against ?? ''} className={inputCls} placeholder="Them" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input name="notes" type="text" defaultValue={currentItem.game.notes ?? ''} className={inputCls} placeholder="Optional" />
              </div>
            </>
          )}
          {!isGame && currentItem.kind === 'training' && (
            <>
              <div>
                <label className={labelCls}>Date &amp; time *</label>
                <input name="session_date" type="datetime-local" required defaultValue={toDatetimeLocal(currentItem.training.session_date)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input name="location" type="text" defaultValue={currentItem.training.location ?? ''} className={inputCls} placeholder="Sengkang Hockey Stadium — Pitch 2" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input name="notes" type="text" defaultValue={currentItem.training.notes ?? ''} className={inputCls} placeholder="Optional" />
              </div>
            </>
          )}
        </form>
      )}
    </ReadEditModal>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  )
}
