'use client'

import { useState, useTransition } from 'react'
import {
  addGame,
  updateGame,
  deleteGame,
  addTraining,
  updateTraining,
  deleteTraining,
  type GameInput,
  type TrainingInput,
} from './actions'
import { setAttendance } from '@/app/dashboard/schedule/actions'
import { fromDatetimeLocal } from '@/lib/format'
import { EventDetailModal, type Game, type Training, type AttendanceRow, type PlayerLite } from '@/components/EventDetailModal'
import { EventRow, type EventItem, type MyStatus } from '@/components/EventRow'
import { eventKey, useEventSelection } from '@/lib/useEventSelection'
import type { PotmPlacing } from '@/components/MatchResultModal'
import type { GoalRow, CardRow } from '@/app/dashboard/schedule/resultActions'
import type { Season } from '@/lib/season'
import Modal from '@/components/Modal'

const inputCls =
  'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
const dateInputCls = `${inputCls} h-[42px]`
const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

export default function ScheduleClient({
  season,
  games,
  trainings,
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
}: {
  /** The season being shown; a locked season is read-only, admins included */
  season: Season
  games: Game[]
  trainings: Training[]
  attending: Record<string, number>
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
}) {
  const [filter, setFilter] = useState<'all' | 'games' | 'trainings'>('all')
  const [addModal, setAddModal] = useState<'game' | 'training' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const items: EventItem[] = [
    ...(filter !== 'trainings' ? games.map((g) => ({ kind: 'game' as const, date: g.game_date, game: g })) : []),
    ...(filter !== 'games'
      ? trainings.map((t) => ({ kind: 'training' as const, date: t.session_date, training: t }))
      : []),
  ]

  const nowMs = new Date(now).getTime()
  const upcoming = items
    .filter((i) => new Date(i.date).getTime() >= nowMs)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = items
    .filter((i) => new Date(i.date).getTime() < nowMs)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const { isDesktop, selected: selectedItem, select: setSelectedItem, isSelected } = useEventSelection(upcoming, past)

  const readOnly = season.locked
  const played = games.filter((g) => g.result)
  const record = {
    w: played.filter((g) => g.result === 'win' || g.result === 'ot_win').length,
    d: played.filter((g) => g.result === 'tie').length,
    l: played.filter((g) => g.result === 'loss' || g.result === 'ot_loss').length,
  }

  function respond(item: EventItem, status: MyStatus) {
    const id = item.kind === 'game' ? item.game.id : item.training.id
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

  function handleDelete() {
    if (!selectedItem) return
    if (!confirm('Delete this event? Attendance and stats tied to it will also be removed.')) return
    startTransition(async () => {
      try {
        if (selectedItem.kind === 'game') await deleteGame(selectedItem.game.id)
        if (selectedItem.kind === 'training') await deleteTraining(selectedItem.training.id)
        setSelectedItem(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function submitAddGame(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: GameInput = {
      opponent: fd.get('opponent') as string,
      game_date: fromDatetimeLocal(fd.get('game_date') as string),
      location: (fd.get('location') as string) || null,
      home_away: (fd.get('home_away') as 'home' | 'away') || null,
      game_type: fd.get('game_type') as GameInput['game_type'],
      // Score is not part of match creation — it's entered post-match via Update result
      goals_for: null,
      goals_against: null,
      notes: (fd.get('notes') as string) || null,
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
    const data: TrainingInput = {
      session_date: fromDatetimeLocal(fd.get('session_date') as string),
      location: (fd.get('location') as string) || null,
      notes: (fd.get('notes') as string) || null,
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

  const detail = selectedItem && (
    <EventDetailModal
      key={eventKey(selectedItem)}
      inline={isDesktop}
      item={selectedItem}
      isAdmin={isAdmin}
      readOnly={readOnly}
      teamListByGame={teamListByGame}
      myStatus={myStatus[selectedItem.kind === 'game' ? selectedItem.game.id : selectedItem.training.id]}
      attendanceBySession={attendanceBySession}
      roster={roster}
      myPlayerId={myPlayerId}
      now={now}
      goalsByGame={goalsByGame}
      cardsByGame={cardsByGame}
      potmByGame={potmByGame}
      onClose={() => { setSelectedItem(null); setError(null) }}
      onSaveGame={handleSaveGame}
      onSaveTraining={handleSaveTraining}
      onDelete={handleDelete}
      isPending={isPending}
    />
  )

  return (
    <div className="liga-page p-4">
      {/* Header */}
      <div className="liga-page-header mb-4 flex items-center justify-between gap-3">
        <h1 className="liga-page-title text-xl text-white">Schedule</h1>
        {!readOnly && (
          <div className="flex items-center gap-2">
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

      {/* Season record */}
      {played.length > 0 && (
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

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <>
              <h2 className="liga-section-title mb-2 text-sm font-semibold text-white">Upcoming</h2>
              <div className="liga-event-list mb-6">
                {upcoming.map((item) => {
                  const id = item.kind === 'game' ? item.game.id : item.training.id
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
                        <EventRow item={item} attending={attending} />
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
                            disabled={isPending && respondingId === id}
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

          {/* Past */}
          <h2 className="liga-section-title mb-2 text-sm font-semibold text-white">
            {upcoming.length > 0 ? 'Past' : `Season ${season.label}`}
          </h2>
          <div className="liga-event-list">
            {past.length === 0 && upcoming.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-500">
                {readOnly ? 'No events in this season.' : 'Nothing scheduled yet. Add a game or training above.'}
              </p>
            )}
            {past.map((item) => (
              <EventCard
                key={`${item.kind}-${item.kind === 'game' ? item.game.id : item.training.id}`}
                item={item}
                attending={attending}
                selected={isSelected(item)}
                onClick={() => setSelectedItem(item)}
              />
            ))}
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
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input name="game_date" type="datetime-local" required className={dateInputCls} />
            </div>
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
              <div className="flex-1">
                <label className={labelCls}>Type</label>
                <select name="game_type" className={inputCls} defaultValue="regular">
                  <option value="regular">Regular</option>
                  <option value="playoff">Playoff</option>
                  <option value="exhibition">Exhibition</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input name="notes" type="text" className={inputCls} placeholder="Optional" />
            </div>
            {error && <p className="liga-alert liga-alert-error rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}
            <ModalButtons isPending={isPending} onCancel={() => { setAddModal(null); setError(null) }} />
          </form>
        </FormModal>
      )}

      {/* Add Training Modal */}
      {addModal === 'training' && (
        <FormModal title="Add Training" onClose={() => { setAddModal(null); setError(null) }}>
          <form onSubmit={submitAddTraining} className="space-y-4">
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input name="session_date" type="datetime-local" required className={dateInputCls} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input name="location" type="text" className={inputCls} placeholder="Sengkang Hockey Stadium — Pitch 2" />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input name="notes" type="text" className={inputCls} placeholder="Optional" />
            </div>
            {error && <p className="liga-alert liga-alert-error rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}
            <ModalButtons isPending={isPending} onCancel={() => { setAddModal(null); setError(null) }} />
          </form>
        </FormModal>
      )}
    </div>
  )
}

function EventCard({
  item,
  attending,
  selected,
  onClick,
}: {
  item: EventItem
  attending: Record<string, number>
  /** Showing in the desktop details panel */
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={selected || undefined}
      data-selected={selected || undefined}
      className="liga-event-card card flex w-full items-center gap-3 px-4 py-3 text-left transition hover:border-white/15"
    >
      <EventRow item={item} attending={attending} />
    </button>
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

function ModalButtons({ isPending, onCancel }: { isPending: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="liga-button liga-button-primary bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
