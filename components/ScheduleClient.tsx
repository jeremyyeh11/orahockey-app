'use client'

import { useState, useTransition } from 'react'
import {
  addGame,
  updateGame,
  deleteGame,
  addTraining,
  updateTraining,
  deleteTraining,
  addEvent,
  updateEvent,
  deleteEvent,
  type EventInput,
  type GameInput,
  type TrainingInput,
} from '@/app/admin/schedule/actions'
import { setAttendance } from '@/app/dashboard/schedule/actions'
import { fromDatetimeLocal } from '@/lib/format'
import { EventDetailModal, type Game, type Training, type TeamEvent, type AttendanceRow, type PlayerLite } from '@/components/EventDetailModal'
import { EventRow, eventFinesEnabled, eventId, eventRespondBy, type EventItem, type MyStatus } from '@/components/EventRow'
import { eventKey, useEventSelection } from '@/lib/useEventSelection'
import { RespondBy, rowCountdownClass } from '@/components/RespondBy'
import { RsvpButtons } from '@/components/RsvpButtons'
import type { FineReason } from '@/lib/fines'
import type { PotmPlacing } from '@/components/MatchResultModal'
import type { GoalRow, CardRow } from '@/app/dashboard/schedule/resultActions'
import type { Season } from '@/lib/season'
import Modal from '@/components/Modal'
import { GameTypeSwitch } from '@/components/GameTypeSwitch'
import { ScheduleTimeFields, readTimeFields } from '@/components/ScheduleTimeFields'
import { FinesFields, readFinesFields } from '@/components/FinesFields'
import { countsForRecord, hasScore } from '@/lib/stats'
import { FormButtons, FormError, inputCls, labelCls } from '@/components/form'

/**
 * The Schedule tab for both areas (ScheduleView loads it). Everyone RSVPs and
 * opens event details; admins also add, edit and delete events, see headcounts
 * on each row and the season's W/D/L record.
 */
export default function ScheduleClient({
  season,
  games,
  trainings,
  events,
  attending,
  myStatus,
  now,
  roster,
  attendanceBySession,
  myPlayerId,
  isAdmin,
  teamListByGame,
  goalsByGame,
  cardsByGame,
  potmByGame,
  initialEventKey,
  fined,
}: {
  /** The season being shown; a locked season is read-only, admins included */
  season: Season
  games: Game[]
  trainings: Training[]
  /** Titled team events — gatherings, meetings… */
  events: TeamEvent[]
  /** Headcount per event (admin rows only) */
  attending?: Record<string, number>
  myStatus: Record<string, MyStatus>
  now: string
  roster: PlayerLite[]
  attendanceBySession: Record<string, AttendanceRow[]>
  myPlayerId: string
  isAdmin: boolean
  teamListByGame: Record<string, Record<string, boolean>>
  goalsByGame: Record<string, GoalRow[]>
  cardsByGame: Record<string, CardRow[]>
  potmByGame: Record<string, PotmPlacing[]>
  /** Event to open on arrival — `game-<id>`, `training-<id>` or `event-<id>` */
  initialEventKey: string | null
  /** Unwaived fines per entry ('training-<id>') and player */
  fined: Record<string, Record<string, FineReason[]>>
}) {
  const [filter, setFilter] = useState<'all' | 'games' | 'trainings' | 'events'>('all')
  const [addModal, setAddModal] = useState<'game' | 'training' | 'event' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const items: EventItem[] = [
    ...(filter === 'all' || filter === 'games' ? games.map((g) => ({ kind: 'game' as const, date: g.game_date, game: g })) : []),
    ...(filter === 'all' || filter === 'trainings'
      ? trainings.map((t) => ({ kind: 'training' as const, date: t.session_date, training: t }))
      : []),
    ...(filter === 'all' || filter === 'events'
      ? events.map((e) => ({ kind: 'event' as const, date: e.event_date, event: e }))
      : []),
  ]

  const nowMs = new Date(now).getTime()
  const upcoming = items
    .filter((i) => new Date(i.date).getTime() >= nowMs)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  // Touch layouts show the reply countdown on this one (and on any under 48h) — see rowCountdownClass
  const firstOpen = upcoming.find((i) => {
    const r = eventRespondBy(i)
    return !!r && new Date(r).getTime() > nowMs
  })
  const past = items
    .filter((i) => new Date(i.date).getTime() < nowMs)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const { isDesktop, selected: selectedItem, select: setSelectedItem, isSelected } = useEventSelection(upcoming, past, initialEventKey)

  const readOnly = season.locked
  // Season record: league games only (friendlies never count)
  const played = games.filter((g) => hasScore(g) && countsForRecord(g))
  const record = {
    w: played.filter((g) => g.result === 'win' || g.result === 'ot_win').length,
    d: played.filter((g) => g.result === 'tie').length,
    l: played.filter((g) => g.result === 'loss' || g.result === 'ot_loss').length,
  }

  function respond(item: EventItem, status: MyStatus) {
    const id = eventId(item)
    setRespondingId(id)
    startTransition(async () => {
      try {
        await setAttendance(id, item.kind, status)
      } finally {
        setRespondingId(null)
      }
    })
  }

  function handleSaveGame(id: string, data: GameInput) {
    startTransition(async () => {
      try {
        await updateGame(id, data)
        // The modal closes after saving; the desktop panel stays on the edited event
        if (!isDesktop) setSelectedItem(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleSaveTraining(id: string, data: TrainingInput) {
    startTransition(async () => {
      try {
        await updateTraining(id, data)
        // The modal closes after saving; the desktop panel stays on the edited event
        if (!isDesktop) setSelectedItem(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleSaveEvent(id: string, data: EventInput) {
    startTransition(async () => {
      try {
        await updateEvent(id, data)
        // The modal closes after saving; the desktop panel stays on the edited event
        if (!isDesktop) setSelectedItem(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleDelete() {
    if (!selectedItem) return
    if (!confirm('Delete this event? Attendance and stats tied to it will also be removed.')) return
    startTransition(async () => {
      try {
        if (selectedItem.kind === 'game') await deleteGame(selectedItem.game.id)
        if (selectedItem.kind === 'training') await deleteTraining(selectedItem.training.id)
        if (selectedItem.kind === 'event') await deleteEvent(selectedItem.event.id)
        setSelectedItem(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function submitAddGame(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const gameDate = fromDatetimeLocal(fd.get('game_date') as string)
    const data: GameInput = {
      opponent: fd.get('opponent') as string,
      game_date: gameDate,
      location: (fd.get('location') as string) || null,
      home_away: (fd.get('home_away') as 'home' | 'away') || null,
      game_type: fd.get('game_type') as GameInput['game_type'],
      // Score is not part of match creation — it's entered post-match via Update result
      goals_for: null,
      goals_against: null,
      notes: (fd.get('notes') as string) || null,
      ...readTimeFields(fd, gameDate),
      ...readFinesFields(fd),
    }
    setError(null)
    startTransition(async () => {
      try {
        await addGame(data)
        setAddModal(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function submitAddTraining(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const sessionDate = fromDatetimeLocal(fd.get('session_date') as string)
    const data: TrainingInput = {
      session_date: sessionDate,
      location: (fd.get('location') as string) || null,
      notes: (fd.get('notes') as string) || null,
      ...readTimeFields(fd, sessionDate),
      ...readFinesFields(fd),
    }
    setError(null)
    startTransition(async () => {
      try {
        await addTraining(data)
        setAddModal(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function submitAddEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const eventDate = fromDatetimeLocal(fd.get('event_date') as string)
    const data: EventInput = {
      title: fd.get('title') as string,
      event_date: eventDate,
      location: (fd.get('location') as string) || null,
      notes: (fd.get('notes') as string) || null,
      ...readTimeFields(fd, eventDate),
      ...readFinesFields(fd),
    }
    setError(null)
    startTransition(async () => {
      try {
        await addEvent(data)
        setAddModal(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  // EventDetailModal only offers edit/delete to admins, in an open season
  const detail = selectedItem && (
    <EventDetailModal
      key={eventKey(selectedItem)}
      inline={isDesktop}
      item={selectedItem}
      isAdmin={isAdmin}
      readOnly={readOnly}
      teamListByGame={teamListByGame}
      myStatus={myStatus[eventId(selectedItem)]}
      attendanceBySession={attendanceBySession}
      roster={roster}
      myPlayerId={myPlayerId}
      now={now}
      goalsByGame={goalsByGame}
      cardsByGame={cardsByGame}
      potmByGame={potmByGame}
      fined={fined[eventKey(selectedItem)]}
      onClose={() => { setSelectedItem(null); setError(null) }}
      onSaveGame={handleSaveGame}
      onSaveTraining={handleSaveTraining}
      onSaveEvent={handleSaveEvent}
      onDelete={handleDelete}
      isPending={isPending}
    />
  )

  return (
    <div className="liga-page p-4">
      {/* Header + add buttons (admins, open seasons only) */}
      <div className="liga-page-header mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="liga-page-title text-xl text-white">Schedule</h1>
        {isAdmin && !readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAddModal('event')}
              className="liga-button liga-button-secondary rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
            >
              + Event
            </button>
            <button
              onClick={() => setAddModal('training')}
              className="liga-button liga-button-secondary rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
            >
              + Training
            </button>
            <button
              onClick={() => setAddModal('game')}
              className="liga-button liga-button-primary bg-accent rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
            >
              + Game
            </button>
          </div>
        )}
      </div>

      {/* Season record (admins) */}
      {isAdmin && played.length > 0 && (
        <div className="liga-meta mb-4 flex gap-4 text-sm text-slate-400">
          <span>
            <span className="font-semibold text-white">{record.w}W</span> ·{' '}
            <span className="font-semibold text-white">{record.d}D</span> ·{' '}
            <span className="font-semibold text-white">{record.l}L</span>
          </span>
          <span>{played.length} games played</span>
        </div>
      )}

      {/* Desktop (lg+): the event list beside a sticky details panel. Touch layouts open details as a modal. */}
      <div className="liga-schedule-layout lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {/* Filter chips */}
          <div className="liga-tabs mb-4 flex gap-1.5">
            {(
              [
                ['all', 'All'],
                ['games', 'Games'],
                ['trainings', 'Trainings'],
                ['events', 'Events'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`liga-tab liga-button rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === key
                    ? 'bg-accent text-white ring-1 ring-white/10'
                    : 'border border-surface-border text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Upcoming — with attendance buttons */}
          {upcoming.length > 0 && (
            <>
              <h2 className="liga-section-title mb-2 text-sm font-semibold text-white">Upcoming</h2>
              <div className="liga-event-list mb-6">
                {upcoming.map((item) => {
                  const id = eventId(item)
                  const mine = myStatus[id]
                  const countdown = readOnly
                    ? null
                    : rowCountdownClass({ respondBy: eventRespondBy(item), replied: !!mine, now, first: !!firstOpen && eventId(firstOpen) === id })
                  return (
                    <div key={`${item.kind}-${id}`} data-selected={isSelected(item) || undefined} className="liga-event-card card px-4 py-3">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-current={isSelected(item) || undefined}
                        onClick={() => setSelectedItem(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setSelectedItem(item) }}
                        className="cursor-pointer"
                      >
                        <EventRow item={item} attending={attending} />
                      </div>
                      {countdown !== null && (
                        <RespondBy respondBy={eventRespondBy(item)} finesEnabled={eventFinesEnabled(item)} now={now} countdownOnly={!!mine} className={`${countdown} ml-14 mt-2`} />
                      )}
                      {!readOnly && (
                        <RsvpButtons value={mine} onPick={(status) => respond(item, status)} disabled={isPending && respondingId === id} className="ml-14 mt-2" />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Past — admins see the headcount, players their own status */}
          <h2 className="liga-section-title mb-2 text-sm font-semibold text-white">
            {upcoming.length > 0 ? 'Past' : season.allTime ? 'All time' : `Season ${season.label}`}
          </h2>
          <div className="liga-event-list">
            {past.length === 0 && upcoming.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-500">
                {readOnly ? 'No events in this season.' : isAdmin ? 'Nothing scheduled yet. Add a game or training above.' : 'Nothing scheduled yet.'}
              </p>
            )}
            {past.map((item) => {
              const id = eventId(item)
              // A div, not a <button>: on desktop rows bleed 0.75rem past the column for
              // their highlight, and a button's fixed width would leave it short on the right
              return (
                <div
                  key={`${item.kind}-${id}`}
                  role="button"
                  tabIndex={0}
                  aria-current={isSelected(item) || undefined}
                  data-selected={isSelected(item) || undefined}
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedItem(item) }}
                  className="liga-event-card card flex cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:border-white/15"
                >
                  {isAdmin ? <EventRow item={item} attending={attending} past /> : <EventRow item={item} mine={myStatus[id]} />}
                </div>
              )
            })}
          </div>

        </div>

        <aside className="liga-schedule-detail hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {isDesktop && detail}
        </aside>
      </div>

      {/* Touch layouts: event details as a modal */}
      {!isDesktop && detail}

      {/* Add Game Modal */}
      {addModal === 'game' && (
        <FormModal title="Add Game" onClose={() => { setAddModal(null); setError(null) }}>
          <form onSubmit={submitAddGame} className="space-y-4">
            <div>
              <label className={labelCls}>Opponent *</label>
              <input name="opponent" type="text" required className={inputCls} placeholder="Tornados" />
            </div>
            <GameTypeSwitch />
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input name="game_date" type="datetime-local" required className={inputCls} />
            </div>
            <ScheduleTimeFields />
            <FinesFields kind="game" startName="game_date" />
            <div>
              <label className={labelCls}>Location</label>
              <input name="location" type="text" className={inputCls} placeholder="Sengkang Hockey Stadium" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Home / Away</label>
                <select name="home_away" className={inputCls} defaultValue="">
                  <option value="">—</option>
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input name="notes" type="text" className={inputCls} placeholder="Optional" />
            </div>
            <FormError error={error} />
            <FormButtons isPending={isPending} onCancel={() => { setAddModal(null); setError(null) }} />
          </form>
        </FormModal>
      )}

      {/* Add Training Modal */}
      {addModal === 'training' && (
        <FormModal title="Add Training" onClose={() => { setAddModal(null); setError(null) }}>
          <form onSubmit={submitAddTraining} className="space-y-4">
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input name="session_date" type="datetime-local" required className={inputCls} />
            </div>
            <ScheduleTimeFields />
            <FinesFields kind="training" startName="session_date" />
            <div>
              <label className={labelCls}>Location</label>
              <input name="location" type="text" className={inputCls} placeholder="Sengkang Hockey Stadium — Pitch 2" />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input name="notes" type="text" className={inputCls} placeholder="Optional" />
            </div>
            <FormError error={error} />
            <FormButtons isPending={isPending} onCancel={() => { setAddModal(null); setError(null) }} />
          </form>
        </FormModal>
      )}

      {/* Add Event Modal — gatherings, meetings, socials… */}
      {addModal === 'event' && (
        <FormModal title="Add Event" onClose={() => { setAddModal(null); setError(null) }}>
          <form onSubmit={submitAddEvent} className="space-y-4">
            <div>
              <label className={labelCls}>Title *</label>
              <input name="title" type="text" required className={inputCls} placeholder="Team dinner, AGM, gathering…" />
            </div>
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input name="event_date" type="datetime-local" required className={inputCls} />
            </div>
            <ScheduleTimeFields />
            <FinesFields kind="event" startName="event_date" />
            <div>
              <label className={labelCls}>Location</label>
              <input name="location" type="text" className={inputCls} placeholder="Optional" />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input name="notes" type="text" className={inputCls} placeholder="Optional" />
            </div>
            <FormError error={error} />
            <FormButtons isPending={isPending} onCancel={() => { setAddModal(null); setError(null) }} />
          </form>
        </FormModal>
      )}
    </div>
  )
}

function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal onClose={onClose} scrollable>
      <h2 className="mb-5 text-lg font-bold text-white">{title}</h2>
      {children}
    </Modal>
  )
}
