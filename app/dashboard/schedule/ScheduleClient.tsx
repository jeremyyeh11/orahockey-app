'use client'

import { useState, useTransition } from 'react'
import { setAttendance } from './actions'
import { EventDetailModal, type Game, type Training, type TeamEvent, type AttendanceRow, type PlayerLite } from '@/components/EventDetailModal'
import { EventRow, eventId, type EventItem, type MyStatus } from '@/components/EventRow'
import { eventKey, useEventSelection } from '@/lib/useEventSelection'
import type { PotmPlacing } from '@/components/MatchResultModal'
import type { GoalRow, CardRow } from './resultActions'
import type { EventInput, GameInput, TrainingInput } from '@/app/admin/schedule/actions'
import { updateGame, updateTraining, updateEvent, deleteGame, deleteTraining, deleteEvent } from '@/app/admin/schedule/actions'
import type { Season } from '@/lib/season'

export default function ScheduleClient({
  season,
  games,
  trainings,
  events,
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
}: {
  /** The season being shown; a locked season is read-only */
  season: Season
  games: Game[]
  trainings: Training[]
  /** Titled team events — gatherings, meetings… */
  events: TeamEvent[]
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
}) {
  const [filter, setFilter] = useState<'all' | 'games' | 'trainings' | 'events'>('all')
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

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
  const past = items
    .filter((i) => new Date(i.date).getTime() < nowMs)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const { isDesktop, selected: selectedItem, select: setSelectedItem, isSelected } = useEventSelection(upcoming, past, initialEventKey)
  const readOnly = season.locked

  function respond(item: EventItem, status: MyStatus) {
    const id = eventId(item)
    setPendingId(id)
    startTransition(async () => {
      try {
        await setAttendance(id, item.kind, status)
      } finally {
        setPendingId(null)
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
        console.error(err)
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
        console.error(err)
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
        console.error(err)
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
        console.error(err)
      }
    })
  }

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
      onClose={() => setSelectedItem(null)}
      onSaveGame={handleSaveGame}
      onSaveTraining={handleSaveTraining}
      onSaveEvent={handleSaveEvent}
      onDelete={handleDelete}
      isPending={isPending}
    />
  )

  return (
    <div className="liga-page p-4">
      <div className="liga-page-header mb-4">
        <h1 className="liga-page-title text-xl text-white">Schedule</h1>
      </div>

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
                        <EventRow item={item} />
                      </div>
                      {!readOnly && (
                      <div className="liga-event-actions mt-2 flex gap-2">
                        {(
                          [
                            ['attending', "I'm in"],
                            ['maybe', 'Maybe'],
                            ['not_attending', 'Out'],
                          ] as const
                        ).map(([status, label]) => (
                          <button
                            key={status}
                            onClick={() => respond(item, status)}
                            disabled={isPending && pendingId === id}
                            className={`liga-button flex-1 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-40 ${
                              mine === status
                                ? status === 'attending'
                                  ? 'bg-accent text-white ring-1 ring-white/10'
                                  : status === 'maybe'
                                  ? 'bg-amber-900/60 text-amber-300'
                                  : 'bg-slate-700 text-slate-300'
                                : 'liga-event-action-quiet text-slate-400 hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Past — read-only with my status */}
          <h2 className="liga-section-title mb-2 text-sm font-semibold text-white">
            {upcoming.length > 0 ? 'Past' : season.allTime ? 'All time' : `Season ${season.label}`}
          </h2>
          <div className="liga-event-list">
            {past.length === 0 && upcoming.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-500">
                {readOnly ? 'No events in this season.' : 'Nothing scheduled yet.'}
              </p>
            )}
            {past.map((item) => {
              const id = eventId(item)
              const mine = myStatus[id]
              return (
                <div
                  key={`${item.kind}-${id}`}
                  role="button"
                  tabIndex={0}
                  aria-current={isSelected(item) || undefined}
                  data-selected={isSelected(item) || undefined}
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedItem(item) }}
                  className="liga-event-card card flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:border-white/15"
                >
                  <EventRow item={item} mine={mine} />
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
    </div>
  )
}

