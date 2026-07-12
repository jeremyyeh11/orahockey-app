'use client'

import { useState } from 'react'
import { ReadEditModal } from './ReadEditModal'
import { preferredName } from './RosterList'
import { fmtDateTime, dateBlock, toDatetimeLocal, fromDatetimeLocal } from '@/lib/format'
import type { GameInput, TrainingInput } from '@/app/admin/schedule/actions'
import { setAttendance } from '@/app/dashboard/schedule/actions'

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

export type PlayerLite = {
  id: string
  full_name: string
  preferred_name: string | null
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

const STATUS_LABELS: Record<string, string> = {
  attending: 'Attending',
  maybe: 'Maybe',
  not_attending: 'Not attending',
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
  myStatus,
  attendanceBySession,
  roster,
  myPlayerId,
  onClose,
  onSaveGame,
  onSaveTraining,
  onDelete,
  isPending,
}: {
  item: EventItem | null
  isAdmin: boolean
  myStatus: MyStatus | undefined
  attendanceBySession: Record<string, AttendanceRow[]>
  roster: PlayerLite[]
  myPlayerId: string
  onClose: () => void
  onSaveGame: (id: string, data: GameInput) => void
  onSaveTraining: (id: string, data: TrainingInput) => void
  onDelete: () => void
  isPending: boolean
}) {
  const [editMode, setEditMode] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  if (!item) return null

  // Capture narrowed values so closures don't lose the null-guard
  const currentItem = item
  const kind = currentItem.kind
  const isGame = kind === 'game'
  const sessionId = isGame ? currentItem.game.id : currentItem.training.id
  const dateStr = isGame ? currentItem.game.game_date : currentItem.training.session_date
  const location = isGame ? currentItem.game.location : currentItem.training.location
  const notes = isGame ? currentItem.game.notes : currentItem.training.notes

  const title = isGame ? `vs ${currentItem.game.opponent}` : 'Training'
  const breakdown = buildBreakdown(attendanceBySession[sessionId], roster, myPlayerId)

  function handleRespond(status: MyStatus) {
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

  return (
    <ReadEditModal
      title={title}
      isOpen={!!item}
      onClose={onClose}
      isAdmin={isAdmin}
      editMode={editMode}
      onEnterEdit={() => setEditMode(true)}
      onSave={() => {
        // Trigger form submit
        const form = document.getElementById('event-edit-form') as HTMLFormElement | null
        form?.requestSubmit()
      }}
      onDiscard={() => setEditMode(false)}
      isPending={isPending}
      onDelete={isAdmin ? onDelete : undefined}
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
                {currentItem.game.result && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Result</span>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${RESULT_BADGE[currentItem.game.result]?.cls ?? 'bg-slate-700 text-slate-300'}`}>
                        {RESULT_BADGE[currentItem.game.result]?.label ?? currentItem.game.result}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {currentItem.game.goals_for}–{currentItem.game.goals_against}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            <DetailRow label="Venue" value={location || 'TBD'} />
          </div>

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
                    myStatus === status
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
                    <div className="flex flex-wrap gap-1">
                      {group.players.map((name) => (
                        <span
                          key={name}
                          className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-300"
                        >
                          {name}
                        </span>
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
