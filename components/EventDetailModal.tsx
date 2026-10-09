'use client'

import { useState, useTransition } from 'react'
import { ReadEditModal } from './ReadEditModal'
import { preferredName } from './RosterList'
import { fmtDateTime, fmtDateTimeRange, fmtReport, toDatetimeLocal, toTimeLocal, fromDatetimeLocal } from '@/lib/format'
import type { EventInput, GameInput, TrainingInput } from '@/app/admin/schedule/actions'
import { eventEnd, eventFinesEnabled, eventId, eventLocation, eventNotes, eventReportMinutes, eventRespondBy, eventTitle, type EventItem } from './EventRow'
import { FINE_AMOUNT, FINE_KIND_NOUN, type FineReason } from '@/lib/fines'
import { RespondBy } from './RespondBy'
import { FormError, inputCls, labelCls } from './form'
import { ScheduleTimeFields, readTimeFields } from './ScheduleTimeFields'
import { FinesFields, readFinesFields } from './FinesFields'
import { GameTypeSwitch } from './GameTypeSwitch'
import { competitionLabel } from '@/lib/constants'
import { setAttendance } from '@/app/dashboard/schedule/actions'
import { TeamListModal } from './TeamListModal'
import {
  MatchResultModal,
  type PotmPlacing,
  CARD_SHAPES,
  POTM_PLACE_LABEL,
  POTM_PLACE_CLS,
  consolidateCards,
} from './MatchResultModal'
import { ChevronRightIcon } from './icons'
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
  /** The opponent's full name (opponents table), e.g. "St Andrew's Alumni" for SAA */
  opponent_name?: string | null
  ends_at?: string | null
  report_minutes?: number | null
  respond_by?: string | null
  fines_enabled?: boolean
}

export type Training = {
  id: string
  session_date: string
  location: string | null
  notes: string | null
  ends_at?: string | null
  report_minutes?: number | null
  respond_by?: string | null
  fines_enabled?: boolean
}

/** A titled team event — gathering, meeting, social… */
export type TeamEvent = {
  id: string
  title: string
  event_date: string
  location: string | null
  notes: string | null
  ends_at?: string | null
  report_minutes?: number | null
  respond_by?: string | null
  fines_enabled?: boolean
  /** When it was posted — team events' default respond-by counts from it */
  created_at?: string
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
  /** When they gave this answer */
  responded_at?: string
  player: { full_name: string; preferred_name: string | null }
}

type MyStatus = 'attending' | 'not_attending' | 'maybe'

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  win: { label: 'W', cls: 'bg-green-900/60 text-green-300' },
  loss: { label: 'L', cls: 'bg-red-900/60 text-red-300' },
  tie: { label: 'D', cls: 'bg-slate-700 text-slate-300' },
  ot_win: { label: 'W·OT', cls: 'bg-green-900/60 text-green-300' },
  ot_loss: { label: 'L·OT', cls: 'bg-red-900/60 text-red-300' },
}


type BreakdownGroup = { label: string; players: { id: string; name: string; at?: string }[] }

function buildBreakdown(
  attendance: AttendanceRow[] | undefined,
  roster: PlayerLite[]
): BreakdownGroup[] {
  const groups: Record<string, (PlayerLite & { at?: string })[]> = {
    attending: [],
    maybe: [],
    not_attending: [],
  }
  const respondedIds = new Set<string>()

  for (const a of attendance ?? []) {
    const p = {
      id: a.player_id,
      full_name: a.player.full_name,
      preferred_name: a.player.preferred_name,
      at: a.responded_at,
    }
    if (groups[a.status]) groups[a.status].push(p)
    respondedIds.add(a.player_id)
  }

  const noResponse = roster.filter((p) => !respondedIds.has(p.id))

  return [
    { label: 'Attending', players: groups.attending.map((p) => ({ id: p.id, name: preferredName(p), at: p.at })) },
    { label: 'Maybe', players: groups.maybe.map((p) => ({ id: p.id, name: preferredName(p), at: p.at })) },
    { label: 'Not attending', players: groups.not_attending.map((p) => ({ id: p.id, name: preferredName(p), at: p.at })) },
    { label: "Hasn't responded", players: noResponse.map((p) => ({ id: p.id, name: preferredName(p) })) },
  ].filter((g) => g.players.length > 0)
}

export function EventDetailModal({
  item,
  isAdmin: isAdminUser,
  readOnly = false,
  teamListByGame,
  myStatus,
  attendanceBySession,
  roster,
  myPlayerId,
  now,
  goalsByGame,
  cardsByGame,
  potmByGame,
  fined,
  onClose,
  onSaveGame,
  onSaveTraining,
  onSaveEvent,
  onDelete,
  inline = false,
}: {
  item: EventItem | null
  isAdmin: boolean
  /** Locked (past) season: view only — no edit, delete, result entry, team list or RSVP, admins included */
  readOnly?: boolean
  teamListByGame: Record<string, Record<string, boolean>>
  myStatus: MyStatus | undefined
  attendanceBySession: Record<string, AttendanceRow[]>
  roster: PlayerLite[]
  myPlayerId: string
  now: string
  goalsByGame: Record<string, GoalRow[]>
  cardsByGame: Record<string, CardRow[]>
  potmByGame: Record<string, PotmPlacing[]>
  /** This event's unwaived fines by player — marked in the attendance list */
  fined?: Record<string, FineReason[]>
  onClose: () => void
  /**
   * Admin edits — only reachable in edit mode, which needs isAdmin. Awaited:
   * a rejected save keeps edit mode open with the error shown.
   */
  onSaveGame?: (id: string, data: GameInput) => Promise<void>
  onSaveTraining?: (id: string, data: TrainingInput) => Promise<void>
  onSaveEvent?: (id: string, data: EventInput) => Promise<void>
  onDelete?: () => Promise<void>
  /** Desktop master–detail: render as the Schedule page's side panel instead of a modal */
  inline?: boolean
}) {
  // Admin controls only apply while the event's season is open
  const isAdmin = isAdminUser && !readOnly
  const [editMode, setEditMode] = useState(false)
  // Admin save/delete: wait for the server, and on failure stay in edit mode with the error shown
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
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
  const sessionId = eventId(currentItem)
  const dateStr = currentItem.date
  const location = eventLocation(currentItem)
  const notes = eventNotes(currentItem)

  const title = eventTitle(currentItem)
  const endIso = eventEnd(currentItem)
  const editEnd = endIso ? toTimeLocal(endIso) : ''
  const breakdown = buildBreakdown(attendanceBySession[sessionId], roster)
  // Reply times: open seasons only (archived ones carry import times)
  const showTimes = !readOnly && breakdown.some((g) => g.players.some((p) => p.at))

  // Update result — matches only, enabled once the match date/time has passed
  const hasStarted = new Date(dateStr).getTime() <= new Date(now).getTime()
  const effectiveScore = localScore ?? (
    isGame && currentItem.kind === 'game' && currentItem.game.result && currentItem.game.result !== 'unrecorded' &&
    currentItem.game.goals_for != null && currentItem.game.goals_against != null
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

  // Match result data for the read-only summary
  const resultGoals = localGoals ?? goalsByGame[sessionId] ?? []
  const resultCards = localCards ?? cardsByGame[sessionId] ?? []
  const resultPotm = potmByGame[sessionId] ?? []
  const nameOf = (id: string | null) => {
    if (!id) return ''
    const p = roster.find((r) => r.id === id)
    return p ? preferredName(p) : '?'
  }
  const attendingCount = attendingPlayerIds.size

  // Section lifecycle: attendance → team list → result. As each later stage is
  // reached, earlier sections default to collapsed (still user-expandable). The
  // `stage` key remounts the sections so the defaults re-apply when it advances.
  const hasResult = !!effectiveScore
  const stage: 'pre' | 'teamlist' | 'result' = hasResult
    ? 'result'
    : isGame && isTeamListPublished
    ? 'teamlist'
    : 'pre'
  const teamListDefaultOpen = stage !== 'result'
  const attendanceDefaultOpen = stage === 'pre'

  function handleRespond(status: MyStatus) {
    setLocalMyStatus(status)
    setRespondingId(sessionId)
    setAttendance(sessionId, kind, status).finally(() => setRespondingId(null))
  }

  function runAdminAction(action: () => Promise<void> | undefined, onDone?: () => void) {
    setSaveError(null)
    startSaving(async () => {
      try {
        await action()
        onDone?.()
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (isGame) {
      const gf = fd.get('goals_for') as string
      const ga = fd.get('goals_against') as string
      const gameDate = fromDatetimeLocal(fd.get('game_date') as string)
      const data: GameInput = {
        opponent: fd.get('opponent') as string,
        game_date: gameDate,
        location: (fd.get('location') as string) || null,
        home_away: (fd.get('home_away') as 'home' | 'away') || null,
        game_type: fd.get('game_type') as GameInput['game_type'],
        goals_for: gf === '' ? null : Number(gf),
        goals_against: ga === '' ? null : Number(ga),
        notes: (fd.get('notes') as string) || null,
        ...readTimeFields(fd, gameDate),
        ...readFinesFields(fd),
      }
      runAdminAction(() => onSaveGame?.(sessionId, data), () => setEditMode(false))
    } else if (kind === 'event') {
      const eventDate = fromDatetimeLocal(fd.get('event_date') as string)
      const data: EventInput = {
        title: fd.get('title') as string,
        event_date: eventDate,
        location: (fd.get('location') as string) || null,
        notes: (fd.get('notes') as string) || null,
        ...readTimeFields(fd, eventDate),
        ...readFinesFields(fd),
      }
      runAdminAction(() => onSaveEvent?.(sessionId, data), () => setEditMode(false))
    } else {
      const sessionDate = fromDatetimeLocal(fd.get('session_date') as string)
      const data: TrainingInput = {
        session_date: sessionDate,
        location: (fd.get('location') as string) || null,
        notes: (fd.get('notes') as string) || null,
        ...readTimeFields(fd, sessionDate),
        ...readFinesFields(fd),
      }
      runAdminAction(() => onSaveTraining?.(sessionId, data), () => setEditMode(false))
    }
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
        isGame && !editMode && !readOnly ? (
          <button
            type="button"
            onClick={() => setShowResult(true)}
            disabled={!hasStarted}
            className="liga-compact-button liga-button-secondary shrink-0 rounded-lg border border-surface-border px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
          >
            Update result
          </button>
        ) : undefined
      }
      isOpen={!!item}
      onClose={onClose}
      isAdmin={isAdmin}
      editInHeader
      inline={inline}
      editMode={editMode}
      onEnterEdit={() => setEditMode(true)}
      onSave={() => {
        const form = document.getElementById('event-edit-form') as HTMLFormElement | null
        form?.requestSubmit()
      }}
      onDiscard={() => { setEditMode(false); setSaveError(null) }}
      isPending={saving}
      onDelete={isAdmin && editMode && onDelete ? () => runAdminAction(onDelete) : undefined}
    >
      {/* READ MODE */}
      {!editMode && (
        <div className="space-y-5">
          {/* Event details */}
          <div className="space-y-2">
            <DetailRow
              label="Date & time"
              value={fmtDateTimeRange(dateStr, endIso)}
              sub={fmtReport(dateStr, eventReportMinutes(currentItem))}
            />
            {isGame && currentItem.kind === 'game' && (
              <>
                <DetailRow
                  label="Opponent"
                  value={currentItem.game.opponent_name ? `${currentItem.game.opponent_name} (${currentItem.game.opponent})` : currentItem.game.opponent}
                />
                <DetailRow label="Home / Away" value={currentItem.game.home_away ? (currentItem.game.home_away === 'home' ? 'Home' : 'Away') : '—'} />
                <DetailRow label="Type" value={competitionLabel(currentItem.game.game_type)} />
              </>
            )}
            <DetailRow label="Venue" value={location || 'TBD'} />
            {eventRespondBy(currentItem) && (
              <DetailRow
                label="Reply by"
                value={fmtDateTime(eventRespondBy(currentItem)!)}
                sub={
                  eventFinesEnabled(currentItem)
                    ? `$${FINE_AMOUNT} fine if late reply, or for a change within 24h before the ${FINE_KIND_NOUN[currentItem.kind]}`
                    : 'No fines'
                }
              />
            )}
          </div>

          {/* Match Result — shown once the score has been entered */}
          {isGame && hasResult && (
            <CollapsibleSection key={`result-${stage}`} title="Match Result" defaultOpen>
              <MatchResultSummary score={effectiveScore} goals={resultGoals} cards={resultCards} potm={resultPotm} nameOf={nameOf} />
            </CollapsibleSection>
          )}

          {/* Team List — published view (all users) or admin button */}
          {isGame && (
            <CollapsibleSection
              key={`teamlist-${stage}`}
              title="Team List"
              defaultOpen={teamListDefaultOpen}
              summary={isTeamListPublished ? `${selectedPlayers.length} named` : undefined}
            >
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
                      className="liga-button liga-button-secondary mt-2 w-full rounded-lg border border-surface-border py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
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
                  className="liga-button liga-button-secondary w-full rounded-lg border border-surface-border py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  {teamListStatus === 'draft' ? 'Edit Team List (Draft)' : 'Select Team List'}
                </button>
              ) : (
                /* Player: not published yet */
                <p className="text-xs text-slate-500">{readOnly ? 'No team list published' : 'To be announced'}</p>
              )}
            </CollapsibleSection>
          )}

          {/* Attendance — your RSVP + the full breakdown */}
          <CollapsibleSection
            key={`attendance-${stage}`}
            title="Attendance"
            defaultOpen={attendanceDefaultOpen}
            summary={`${attendingCount} in`}
          >
            {!readOnly && (
            <div className="mb-4">
              {eventRespondBy(currentItem) &&
                (!localMyStatus || new Date(eventRespondBy(currentItem)!).getTime() > new Date(now).getTime()) && (
                  <RespondBy respondBy={eventRespondBy(currentItem)} finesEnabled={eventFinesEnabled(currentItem)} now={now} countdownOnly className="mb-3" />
                )}
              <div className="mb-2 text-[11px] font-medium text-slate-500">Your response</div>
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
                    className={`liga-button liga-attendance-choice flex-1 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-40 ${
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
            )}

            {breakdown.length > 0 && (
              <div className="space-y-2">
                {breakdown.map((group, i) => (
                  <div key={group.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[11px] font-medium text-slate-500">
                      <span>
                        {group.label} ({group.players.length})
                      </span>
                      {/* Heading for the times column (once, on the first group) */}
                      {i === 0 && showTimes && <span className="liga-section-title shrink-0 normal-case tracking-normal">Responded on</span>}
                    </div>
                    <div className="space-y-0.5">
                      {group.players.map(({ id, name, at }) => (
                        <div
                          key={id}
                          data-fined={fined?.[id]?.length ? '' : undefined}
                          className={`liga-breakdown-row -mx-1.5 flex items-baseline justify-between gap-3 rounded px-1.5 py-px text-[11px] ${
                            fined?.[id]?.length ? 'bg-red-900/40 text-red-200' : 'text-slate-300'
                          }`}
                        >
                          <span className="min-w-0 break-words">
                            {name}
                            {/* Fined (unwaived): a late or missing reply, or a change within 24h before the start */}
                            {fined?.[id]?.map((reason) => (
                              <span key={reason} className="liga-fine-mark ml-1.5 rounded bg-red-900/50 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-red-300">
                                {reason === 'late_change' ? 'Late change' : 'Late'}
                              </span>
                            ))}
                          </span>
                          {/* When they gave this answer — open seasons only (archived ones carry import times) */}
                          {at && showTimes && (
                            <span className={`liga-meta shrink-0 ${fined?.[id]?.length ? 'text-red-300' : 'text-slate-500'}`}>{fmtDateTime(at)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Additional Information */}
          {notes && (
            <div>
              <h3 className="liga-section-title mb-1.5">Additional Information</h3>
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
              <ScheduleTimeFields defaultEnd={editEnd} defaultReport={eventReportMinutes(currentItem)} />
              <FinesFields
                kind="game"
                startName="game_date"
                saved={{ respondBy: currentItem.game.respond_by ?? null, finesEnabled: currentItem.game.fines_enabled ?? false }}
              />
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
              </div>
              <GameTypeSwitch defaultValue={currentItem.game.game_type} />
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
          {currentItem.kind === 'event' && (
            <>
              <div>
                <label className={labelCls}>Title *</label>
                <input name="title" type="text" required defaultValue={currentItem.event.title} className={inputCls} placeholder="Team dinner" />
              </div>
              <div>
                <label className={labelCls}>Date &amp; time *</label>
                <input name="event_date" type="datetime-local" required defaultValue={toDatetimeLocal(currentItem.event.event_date)} className={inputCls} />
              </div>
              <ScheduleTimeFields defaultEnd={editEnd} defaultReport={eventReportMinutes(currentItem)} />
              <FinesFields
                kind="event"
                startName="event_date"
                postedAt={currentItem.event.created_at}
                saved={{ respondBy: currentItem.event.respond_by ?? null, finesEnabled: currentItem.event.fines_enabled ?? false }}
              />
              <div>
                <label className={labelCls}>Location</label>
                <input name="location" type="text" defaultValue={currentItem.event.location ?? ''} className={inputCls} placeholder="Optional" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input name="notes" type="text" defaultValue={currentItem.event.notes ?? ''} className={inputCls} placeholder="Optional" />
              </div>
            </>
          )}
          {!isGame && currentItem.kind === 'training' && (
            <>
              <div>
                <label className={labelCls}>Date &amp; time *</label>
                <input name="session_date" type="datetime-local" required defaultValue={toDatetimeLocal(currentItem.training.session_date)} className={inputCls} />
              </div>
              <ScheduleTimeFields defaultEnd={editEnd} defaultReport={eventReportMinutes(currentItem)} />
              <FinesFields
                kind="training"
                startName="session_date"
                saved={{ respondBy: currentItem.training.respond_by ?? null, finesEnabled: currentItem.training.fines_enabled ?? false }}
              />
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
          <FormError error={saveError} />
        </form>
      )}
    </ReadEditModal>
  )
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-400">{label}</span>
      <span className="text-right text-sm text-white">
        {value}
        {/* e.g. the report-early time under the date & time */}
        {sub && <span className="liga-event-report mt-0.5 block text-[11px] text-slate-400">{sub}</span>}
      </span>
    </div>
  )
}

/** A titled, expandable section. Starts open/closed per `defaultOpen`; the caller
 *  changes the `key` when the event's stage advances so the default re-applies. */
function CollapsibleSection({
  title,
  defaultOpen,
  summary,
  children,
}: {
  title: string
  defaultOpen: boolean
  summary?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="liga-collapsible overflow-hidden rounded-xl border border-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="liga-collapsible-header flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.02]"
      >
        <span className="liga-section-title">{title}</span>
        <span className="flex items-center gap-2">
          {!open && summary != null && (
            <span className="text-[11px] font-medium text-slate-500">{summary}</span>
          )}
          <ChevronRightIcon
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </span>
      </button>
      {open && <div className="liga-collapsible-content border-t border-white/5 px-3 pb-3 pt-3">{children}</div>}
    </div>
  )
}

/** Read-only match result: prominent score, then scorers (with assists), cards and POTM. */
function MatchResultSummary({
  score,
  goals,
  cards,
  potm,
  nameOf,
}: {
  score: { gf: number; ga: number; result: string } | null
  goals: GoalRow[]
  cards: CardRow[]
  potm: PotmPlacing[]
  nameOf: (id: string | null) => string
}) {
  const sortedGoals = [...goals].sort((a, b) => a.goal_number - b.goal_number)
  const consolidated = consolidateCards(cards).sort((a, b) =>
    nameOf(a.player_id).localeCompare(nameOf(b.player_id))
  )
  const potmByPlace = [1, 2, 3]
    .map((place) => ({
      place,
      names: potm.filter((p) => p.place === place).map((p) => nameOf(p.player_id)),
    }))
    .filter((row) => row.names.length > 0)

  function assistLabel(g: GoalRow): string {
    if (!g.assist_kind) return ''
    if (g.assist_kind === 'pc') return 'PC'
    if (g.assist_kind === 'ps') return 'PS'
    return g.assist_player_id ? nameOf(g.assist_player_id) : ''
  }

  return (
    <div className="space-y-4">
      {score && (
        <div className="flex flex-col items-center gap-1 pb-1">
          <span className="font-display text-4xl font-extrabold leading-none text-white">
            {score.gf}<span className="text-slate-500">–</span>{score.ga}
          </span>
          <span className={`liga-status-label liga-result-label text-xs font-bold ${RESULT_BADGE[score.result]?.cls ?? 'bg-slate-700 text-slate-300'}`}>
            {RESULT_BADGE[score.result]?.label ?? score.result}
          </span>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[11px] font-medium text-slate-500">Scorers</div>
        {sortedGoals.length === 0 ? (
          <p className="text-[11px] text-slate-500">No goals scored.</p>
        ) : (
          <div className="space-y-1">
            {sortedGoals.map((g) => {
              const assist = assistLabel(g)
              return (
                <div key={g.id} className="flex items-baseline gap-2 text-xs">
                  <span className="w-4 shrink-0 text-center text-slate-500">{g.goal_number}</span>
                  <span className="text-white">{nameOf(g.scorer_id)}</span>
                  {assist && <span className="text-slate-500">· {assist}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {consolidated.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-slate-500">Cards</div>
          <div className="space-y-0.5">
            {consolidated.map((c) => (
              <div key={`${c.player_id}-${c.card_type}`} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-300">{nameOf(c.player_id)}</span>
                <span className={CARD_SHAPES[c.card_type].cls}>{CARD_SHAPES[c.card_type].shape}</span>
                <span className="text-slate-500">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {potmByPlace.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-slate-500">Player of the Match</div>
          <div className="space-y-0.5">
            {potmByPlace.map(({ place, names }) => (
              <div key={place} className="text-xs">
                <span className={`font-bold ${POTM_PLACE_CLS[place]}`}>{POTM_PLACE_LABEL[place]}</span>{' '}
                <span className="text-white">{names.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
