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
import { fmtTime, dateBlock, toDatetimeLocal, fromDatetimeLocal } from '@/lib/format'

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
}

export type Training = {
  id: string
  session_date: string
  location: string | null
  notes: string | null
}

type EventItem =
  | { kind: 'game'; date: string; game: Game }
  | { kind: 'training'; date: string; training: Training }

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
}: {
  games: Game[]
  trainings: Training[]
  attending: Record<string, number>
}) {
  const [filter, setFilter] = useState<'all' | 'games' | 'trainings'>('all')
  const [gameModal, setGameModal] = useState<{ game: Game | null } | null>(null)
  const [trainingModal, setTrainingModal] = useState<{ training: Training | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const items: EventItem[] = [
    ...(filter !== 'trainings' ? games.map((g) => ({ kind: 'game' as const, date: g.game_date, game: g })) : []),
    ...(filter !== 'games'
      ? trainings.map((t) => ({ kind: 'training' as const, date: t.session_date, training: t }))
      : []),
  ]

  const now = Date.now()
  const upcoming = items
    .filter((i) => new Date(i.date).getTime() >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = items
    .filter((i) => new Date(i.date).getTime() < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const played = games.filter((g) => g.result)
  const record = {
    w: played.filter((g) => g.result === 'win' || g.result === 'ot_win').length,
    d: played.filter((g) => g.result === 'tie').length,
    l: played.filter((g) => g.result === 'loss' || g.result === 'ot_loss').length,
  }

  function closeModals() {
    setGameModal(null)
    setTrainingModal(null)
    setError(null)
  }

  function submitGame(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
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
    setError(null)
    startTransition(async () => {
      try {
        if (gameModal?.game) {
          await updateGame(gameModal.game.id, data)
        } else {
          await addGame(data)
        }
        closeModals()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function submitTraining(e: React.FormEvent<HTMLFormElement>) {
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
        if (trainingModal?.training) {
          await updateTraining(trainingModal.training.id, data)
        } else {
          await addTraining(data)
        }
        closeModals()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleDelete() {
    if (!confirm('Delete this event? Attendance and stats tied to it will also be removed.')) return
    startTransition(async () => {
      try {
        if (gameModal?.game) await deleteGame(gameModal.game.id)
        if (trainingModal?.training) await deleteTraining(trainingModal.training.id)
        closeModals()
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
            onClick={() => setTrainingModal({ training: null })}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
          >
            + Training
          </button>
          <button
            onClick={() => setGameModal({ game: null })}
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
            {upcoming.map((item) => (
              <EventCard
                key={`${item.kind}-${item.kind === 'game' ? item.game.id : item.training.id}`}
                item={item}
                attending={attending}
                onEdit={() =>
                  item.kind === 'game'
                    ? setGameModal({ game: item.game })
                    : setTrainingModal({ training: item.training })
                }
              />
            ))}
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
            onEdit={() =>
              item.kind === 'game'
                ? setGameModal({ game: item.game })
                : setTrainingModal({ training: item.training })
            }
          />
        ))}
      </div>

      {/* Game modal */}
      {gameModal && (
        <Modal title={gameModal.game ? 'Edit Game' : 'Add Game'} onClose={closeModals}>
          <form onSubmit={submitGame} className="space-y-4">
            <div>
              <label className={labelCls}>Opponent *</label>
              <input
                name="opponent"
                type="text"
                required
                defaultValue={gameModal.game?.opponent}
                className={inputCls}
                placeholder="Khalsa Association"
              />
            </div>

            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input
                name="game_date"
                type="datetime-local"
                required
                defaultValue={gameModal.game ? toDatetimeLocal(gameModal.game.game_date) : ''}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Location</label>
              <input
                name="location"
                type="text"
                defaultValue={gameModal.game?.location ?? ''}
                className={inputCls}
                placeholder="Sengkang Hockey Stadium"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Home / Away</label>
                <select name="home_away" defaultValue={gameModal.game?.home_away ?? ''} className={inputCls}>
                  <option value="">—</option>
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Type</label>
                <select name="game_type" defaultValue={gameModal.game?.game_type ?? 'regular'} className={inputCls}>
                  <option value="regular">Regular</option>
                  <option value="playoff">Playoff</option>
                  <option value="exhibition">Exhibition</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Score (leave blank if not played yet)</label>
              <div className="flex items-center gap-3">
                <input
                  name="goals_for"
                  type="number"
                  min="0"
                  max="99"
                  defaultValue={gameModal.game?.goals_for ?? ''}
                  className={inputCls}
                  placeholder="Us"
                />
                <span className="text-slate-500">–</span>
                <input
                  name="goals_against"
                  type="number"
                  min="0"
                  max="99"
                  defaultValue={gameModal.game?.goals_against ?? ''}
                  className={inputCls}
                  placeholder="Them"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <input
                name="notes"
                type="text"
                defaultValue={gameModal.game?.notes ?? ''}
                className={inputCls}
                placeholder="Optional"
              />
            </div>

            {error && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

            <ModalButtons
              isPending={isPending}
              onCancel={closeModals}
              onDelete={gameModal.game ? handleDelete : undefined}
            />
          </form>
        </Modal>
      )}

      {/* Training modal */}
      {trainingModal && (
        <Modal title={trainingModal.training ? 'Edit Training' : 'Add Training'} onClose={closeModals}>
          <form onSubmit={submitTraining} className="space-y-4">
            <div>
              <label className={labelCls}>Date &amp; time *</label>
              <input
                name="session_date"
                type="datetime-local"
                required
                defaultValue={
                  trainingModal.training ? toDatetimeLocal(trainingModal.training.session_date) : ''
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Location</label>
              <input
                name="location"
                type="text"
                defaultValue={trainingModal.training?.location ?? ''}
                className={inputCls}
                placeholder="Sengkang Hockey Stadium — Pitch 2"
              />
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <input
                name="notes"
                type="text"
                defaultValue={trainingModal.training?.notes ?? ''}
                className={inputCls}
                placeholder="Optional"
              />
            </div>

            {error && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

            <ModalButtons
              isPending={isPending}
              onCancel={closeModals}
              onDelete={trainingModal.training ? handleDelete : undefined}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}

function EventCard({
  item,
  attending,
  onEdit,
}: {
  item: EventItem
  attending: Record<string, number>
  onEdit: () => void
}) {
  const isGame = item.kind === 'game'
  const id = isGame ? item.game.id : item.training.id
  const block = dateBlock(item.date)
  const going = attending[id]

  return (
    <button
      onClick={onEdit}
      className="card flex w-full items-center gap-3 px-4 py-3 text-left transition hover:border-white/15"
    >
      {/* Date block */}
      <div className="flex w-11 shrink-0 flex-col items-center justify-center leading-tight">
        <span className="text-xl font-bold text-white">{block.day}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{block.mon}</span>
      </div>

      {/* Details */}
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

      {/* Result / score */}
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
    </button>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-card px-6 pb-8 pt-6 shadow-xl sm:max-w-sm sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
        <h2 className="mb-5 text-lg font-bold text-white">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ModalButtons({
  isPending,
  onCancel,
  onDelete,
}: {
  isPending: boolean
  onCancel: () => void
  onDelete?: () => void
}) {
  return (
    <div className="space-y-3 pt-1">
      <div className="flex gap-3">
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
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="w-full rounded-lg border border-red-900/60 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-900/20 disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  )
}
