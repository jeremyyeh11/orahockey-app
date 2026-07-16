'use client'

import { useState, useTransition } from 'react'
import { setAttendance } from './actions'
import { EventDetailModal, type Game, type Training, type AttendanceRow, type PlayerLite } from '@/components/EventDetailModal'
import { EventRow, type EventItem, type MyStatus } from '@/components/EventRow'
import type { PotmPlacing } from '@/components/MatchResultModal'
import type { GoalRow, CardRow } from './resultActions'
import type { GameInput, TrainingInput } from '@/app/admin/schedule/actions'
import { updateGame, updateTraining, deleteGame, deleteTraining } from '@/app/admin/schedule/actions'

export default function ScheduleClient({
  games,
  trainings,
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
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<EventItem | null>(null)

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

  function respond(item: EventItem, status: MyStatus) {
    const id = item.kind === 'game' ? item.game.id : item.training.id
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
        setSelectedItem(null)
      } catch (err) {
        console.error(err)
      }
    })
  }

  function handleSaveTraining(id: string, data: TrainingInput) {
    startTransition(async () => {
      try {
        await updateTraining(id, data)
        setSelectedItem(null)
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
        setSelectedItem(null)
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-white">Schedule</h1>

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

      {/* Upcoming — with attendance buttons */}
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
                    <EventRow item={item} />
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
                        disabled={isPending && pendingId === id}
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

      {/* Past — read-only with my status */}
      <h2 className="mb-2 text-sm font-semibold text-white">
        {upcoming.length > 0 ? 'Past' : `Season ${new Date(now).getFullYear()}`}
      </h2>
      <div className="space-y-2">
        {past.length === 0 && upcoming.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">Nothing scheduled yet.</p>
        )}
        {past.map((item) => {
          const id = item.kind === 'game' ? item.game.id : item.training.id
          const mine = myStatus[id]
          return (
            <div
              key={`${item.kind}-${id}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedItem(item)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelectedItem(item) }}
              className="card flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:border-white/15"
            >
              <EventRow item={item} mine={mine} />
            </div>
          )
        })}
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
          onClose={() => setSelectedItem(null)}
          onSaveGame={handleSaveGame}
          onSaveTraining={handleSaveTraining}
          onDelete={handleDelete}
          isPending={isPending}
        />
      )}
    </div>
  )
}

