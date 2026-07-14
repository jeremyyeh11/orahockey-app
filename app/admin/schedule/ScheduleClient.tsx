'use client'

import { useState, useTransition, useEffect } from 'react'
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
import { fmtTime, dateBlock, toDatetimeLocal, fromDatetimeLocal } from '@/lib/format'
import { EventDetailModal, type Game, type Training, type AttendanceRow, type PlayerLite } from '@/components/EventDetailModal'
import type { PotmPlacing } from '@/components/MatchResultModal'
import type { GoalRow, CardRow } from '@/app/dashboard/schedule/resultActions'

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

export default function ScheduleClient({
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
  const [selectedItem, setSelectedItem] = useState<EventItem | null>(null)
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
        setSelectedItem(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleSaveTraining(id: string, data: TrainingInput) {
    startTransition(async () => {
      try {
        await updateTraining(id, data)
        setSelectedItem(null)
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

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Schedule</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddModal('training')}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
          >
            + Training
          </button>
          <button
            onClick={() => setAddModal('game')}
            className="bg-accent rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
          >
            + Game
          </button>
        </div>
      </div>

      {/* Season record */}
      {played.length > 0 && (
        <div className="mb-4 flex gap-4 text-sm text-slate-400">
          <span>
            <span className="font-semibold text-white">{record.w}W</span> ·{' '}
            <span className="font-semibold text-white">{record.d}D</span> ·{' '}
            <span className="font-semibold text-white">{record.l}L</span>
          </span>
          <span>{played.length} games played</span>
        </div>
      )}

      {/* Filter chips */}
      <div className="mb-4 flex gap-1.5">
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
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
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
          <h2 className="mb-2 text-sm font-semibold text-white">Upcoming</h2>
          <div className="mb-6 space-y-2">
            {upcoming.map((item) => {
              const id = item.kind === 'game' ? item.game.id : item.training.id
              const mine = myStatus[id]
              return (
                <div key={`${item.kind}-${id}`} className="card px-4 py-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedItem(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedItem(item) }}
                    className="cursor-pointer"
                  >
                    <EventRow item={item} attending={attending} />
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
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
                        className={`flex-1 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-40 ${
                          mine === status
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
              )
            })}
          </div>
        </>
      )}

      {/* Past */}
      <h2 className="mb-2 text-sm font-semibold text-white">
        {upcoming.length > 0 ? 'Past' : 'Season 2026'}
      </h2>
      <div className="space-y-2">
        {past.length === 0 && upcoming.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">
            Nothing scheduled yet. Add a game or training above.
          </p>
        )}
        {past.map((item) => (
          <EventCard
            key={`${item.kind}-${item.kind === 'game' ? item.game.id : item.training.id}`}
            item={item}
            attending={attending}
            onClick={() => setSelectedItem(item)}
          />
        ))}
      </div>

      {/* Event Detail Modal */}
      {selectedItem && (
        <EventDetailModal
          item={selectedItem}
          isAdmin={isAdmin}
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
      )}

      {/* Add Game Modal */}
      {addModal === 'game' && (
        <Modal title="Add Game" onClose={() => { setAddModal(null); setError(null) }}>
          <form onSubmit={submitAddGame} className="space-y-4">
            <div>
              <label className={labelCls}>Opponent *</label>
              <input name="opponent" type="text" required className={inputCls} placeholder="Tornados" />
            </div>
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input name="game_date" type="datetime-local" required className={inputCls} />
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
            {error && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}
            <ModalButtons isPending={isPending} onCancel={() => { setAddModal(null); setError(null) }} />
          </form>
        </Modal>
      )}

      {/* Add Training Modal */}
      {addModal === 'training' && (
        <Modal title="Add Training" onClose={() => { setAddModal(null); setError(null) }}>
          <form onSubmit={submitAddTraining} className="space-y-4">
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input name="session_date" type="datetime-local" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input name="location" type="text" className={inputCls} placeholder="Sengkang Hockey Stadium — Pitch 2" />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input name="notes" type="text" className={inputCls} placeholder="Optional" />
            </div>
            {error && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}
            <ModalButtons isPending={isPending} onCancel={() => { setAddModal(null); setError(null) }} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function EventRow({ item, attending }: { item: EventItem; attending: Record<string, number> }) {
  const isGame = item.kind === 'game'
  const id = isGame ? item.game.id : item.training.id
  const block = dateBlock(item.date)
  const going = attending[id]

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex w-11 shrink-0 flex-col items-center justify-center leading-tight">
        <span className="text-xl font-bold text-white">{block.day}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{block.mon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {isGame ? `vs ${item.game.opponent}` : 'Training'}
          </span>
          {isGame && item.game.game_type !== 'regular' && (
            <span className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
              {item.game.game_type}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-400">
          {fmtTime(item.date)}
          {(isGame ? item.game.location : item.training.location) &&
            ` · ${isGame ? item.game.location : item.training.location}`}
          {isGame && item.game.home_away && ` · ${item.game.home_away === 'home' ? 'Home' : 'Away'}`}
        </div>
        {going != null && <div className="mt-0.5 text-[11px] text-slate-500">{going} attending</div>}
      </div>
      {isGame && item.game.result && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-bold ${
              RESULT_BADGE[item.game.result]?.cls ?? 'bg-slate-700 text-slate-300'
            }`}
          >
            {RESULT_BADGE[item.game.result]?.label ?? item.game.result}
          </span>
          <span className="text-sm font-semibold text-white">
            {item.game.goals_for}–{item.game.goals_against}
          </span>
        </div>
      )}
    </div>
  )
}

function EventCard({
  item,
  attending,
  onClick,
}: {
  item: EventItem
  attending: Record<string, number>
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card flex w-full items-center gap-3 px-4 py-3 text-left transition hover:border-white/15"
    >
      <EventRow item={item} attending={attending} />
    </button>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto scrollbar-hide rounded-t-2xl border border-surface-border bg-surface-card px-6 pb-8 pt-6 shadow-xl sm:max-w-sm sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
        <h2 className="mb-5 text-lg font-bold text-white">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ModalButtons({ isPending, onCancel }: { isPending: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
