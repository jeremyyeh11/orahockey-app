'use client'

import { useState, useTransition } from 'react'
import { setAttendance } from './actions'
import { fmtTime, dateBlock } from '@/lib/format'
import { EventDetailModal, type Game, type Training, type AttendanceRow, type PlayerLite } from '@/components/EventDetailModal'
import type { GameInput, TrainingInput } from '@/app/admin/schedule/actions'
import { updateGame, updateTraining, deleteGame, deleteTraining } from '@/app/admin/schedule/actions'

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

const STATUS_CHIP: Record<MyStatus, { label: string; cls: string }> = {
  attending: { label: 'Went', cls: 'text-green-400' },
  maybe: { label: 'Maybe', cls: 'text-amber-400' },
  not_attending: { label: 'Missed', cls: 'text-slate-500' },
}

export default function ScheduleClient({
  games,
  trainings,
  myStatus,
  now,
  roster,
  attendanceBySession,
  myPlayerId,
}: {
  games: Game[]
  trainings: Training[]
  myStatus: Record<string, MyStatus>
  now: string
  roster: PlayerLite[]
  attendanceBySession: Record<string, AttendanceRow[]>
  myPlayerId: string
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
        {upcoming.length > 0 ? 'Past' : 'Season 2026'}
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
          isAdmin={false}
          myStatus={myStatus[selectedItem.kind === 'game' ? selectedItem.game.id : selectedItem.training.id]}
          attendanceBySession={attendanceBySession}
          roster={roster}
          myPlayerId={myPlayerId}
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

function EventRow({ item, mine }: { item: EventItem; mine?: MyStatus }) {
  const isGame = item.kind === 'game'
  const block = dateBlock(item.date)

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
        {mine && (
          <div className={`mt-0.5 text-[11px] ${STATUS_CHIP[mine].cls}`}>{STATUS_CHIP[mine].label}</div>
        )}
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
