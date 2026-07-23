'use client'

import { useEffect, useRef, useState } from 'react'
import { preferredName } from './RosterList'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import type { Game, PlayerLite } from './EventDetailModal'
import {
  setMatchScore,
  saveGoal,
  deleteGoal,
  reorderGoals,
  addCard,
  removeCard,
  type GoalRow,
  type CardRow,
} from '@/app/dashboard/schedule/resultActions'

export const CARD_SHAPES: Record<CardRow['card_type'], { shape: string; cls: string; label: string }> = {
  green: { shape: '▲', cls: 'text-green-400', label: 'Green' },
  yellow: { shape: '■', cls: 'text-yellow-400', label: 'Yellow' },
  red: { shape: '●', cls: 'text-red-400', label: 'Red' },
}

// Placings from the vote-POTM system (#5); populated once a poll closes.
export type PotmPlacing = { player_id: string; place: number }

export const POTM_PLACE_LABEL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' }
export const POTM_PLACE_CLS: Record<number, string> = {
  1: 'text-yellow-300',
  2: 'text-slate-300',
  3: 'text-amber-600',
}

const selectCls =
  'rounded-lg border border-surface-border bg-surface px-2 py-2 text-xs text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-40'

/**
 * Result entry for a played match (backlog #4). Open to ALL players:
 * anyone enters the final score, which spawns one scorer slot per goal we scored;
 * slots are filled from the match team list (or full roster if no list is published),
 * re-orderable by dragging. Cards are consolidated at the bottom. POTM space is
 * reserved for the vote-POTM system (#5).
 */
export function MatchResultModal({
  game,
  players,
  roster,
  initialGoals,
  initialCards,
  potm = [],
  onClose,
  onScoreChange,
  onGoalsChange,
  onCardsChange,
}: {
  game: Game
  players: PlayerLite[] // selectable scorers/assists/card recipients (team list or roster fallback)
  roster: PlayerLite[] // everyone, for name lookups
  initialGoals: GoalRow[]
  initialCards: CardRow[]
  potm?: PotmPlacing[] // POTM placings (vote-POTM #5), shown once the poll closes
  onClose: () => void
  onScoreChange: (goalsFor: number, goalsAgainst: number, result: string) => void
  onGoalsChange: (goals: GoalRow[]) => void
  onCardsChange: (cards: CardRow[]) => void
}) {
  // Committed score (drives the number of scorer slots)
  const [score, setScore] = useState<{ gf: number | null; ga: number | null }>({
    gf: game.goals_for,
    ga: game.goals_against,
  })
  const [gfInput, setGfInput] = useState(game.goals_for?.toString() ?? '')
  const [gaInput, setGaInput] = useState(game.goals_against?.toString() ?? '')

  // Scorer slots: index i = goal i+1 in chronological order, null = not filled yet
  const [slots, setSlots] = useState<(GoalRow | null)[]>(() =>
    buildSlots(initialGoals, game.goals_for ?? 0)
  )
  const [cards, setCards] = useState<CardRow[]>(initialCards)
  const [addingCard, setAddingCard] = useState(false)
  const [cardPlayer, setCardPlayer] = useState('')
  const [cardType, setCardType] = useState<CardRow['card_type']>('green')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drag re-ordering
  const listRef = useRef<HTMLDivElement>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const drag = useRef({ from: -1, startY: 0, rowH: 48, moved: false })

  useModalScrollLock()

  // Report changes up so the detail view (and a reopened modal) stays fresh
  const report = useRef({ onGoalsChange, onCardsChange })
  report.current = { onGoalsChange, onCardsChange }
  useEffect(() => {
    report.current.onGoalsChange(slots.filter((g): g is GoalRow => g !== null))
  }, [slots])
  useEffect(() => {
    report.current.onCardsChange(cards)
  }, [cards])

  const nameOf = (id: string | null) => {
    if (!id) return ''
    const p = roster.find((r) => r.id === id)
    return p ? preferredName(p) : '?'
  }

  function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    fn()
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setBusy(false))
  }

  // ── Score ──
  const gfNum = gfInput === '' ? null : Number(gfInput)
  const gaNum = gaInput === '' ? null : Number(gaInput)
  const scoreValid =
    gfNum != null && gaNum != null &&
    Number.isInteger(gfNum) && Number.isInteger(gaNum) &&
    gfNum >= 0 && gfNum <= 99 && gaNum >= 0 && gaNum <= 99
  const scoreChanged = gfNum !== score.gf || gaNum !== score.ga

  function handleSaveScore() {
    if (!scoreValid || gfNum == null || gaNum == null) return
    const filledBeyond = slots.filter((g, i) => g && i >= gfNum).length
    if (filledBeyond > 0 && !confirm(`Lowering the score removes ${filledBeyond} recorded goal${filledBeyond > 1 ? 's' : ''}. Continue?`)) {
      return
    }
    run(async () => {
      await setMatchScore(game.id, gfNum, gaNum)
      setScore({ gf: gfNum, ga: gaNum })
      setSlots((prev) => buildSlots(prev.filter((g): g is GoalRow => !!g && g.goal_number <= gfNum), gfNum))
      onScoreChange(gfNum, gaNum, gfNum > gaNum ? 'win' : gfNum < gaNum ? 'loss' : 'tie')
    })
  }

  // ── Scorer slots ──
  function handleScorerChange(index: number, scorerId: string) {
    const existing = slots[index]
    if (!scorerId) {
      if (!existing) return
      setSlots((prev) => prev.map((g, i) => (i === index ? null : g)))
      run(() => deleteGoal(game.id, index + 1))
      return
    }
    // Keep the assist unless it was the newly-picked scorer assisting themself
    const assist =
      existing?.assist_kind === 'player' && existing.assist_player_id !== scorerId
        ? existing.assist_player_id
        : existing?.assist_kind === 'pc' || existing?.assist_kind === 'ps'
        ? existing.assist_kind
        : null
    run(async () => {
      const row = await saveGoal(game.id, index + 1, scorerId, assist)
      setSlots((prev) => prev.map((g, i) => (i === index ? row : g)))
    })
  }

  function handleAssistChange(index: number, assist: string) {
    const existing = slots[index]
    if (!existing) return
    run(async () => {
      const row = await saveGoal(game.id, index + 1, existing.scorer_id, assist || null)
      setSlots((prev) => prev.map((g, i) => (i === index ? row : g)))
    })
  }

  function assistValue(g: GoalRow | null) {
    if (!g || !g.assist_kind) return ''
    return g.assist_kind === 'player' ? g.assist_player_id ?? '' : g.assist_kind
  }

  // ── Drag re-order ──
  function handleDragStart(index: number, e: React.PointerEvent) {
    if (busy || !slots[index]) return
    e.preventDefault()
    const rows = listRef.current?.querySelectorAll('[data-slot-row]')
    const rowH = rows && rows[0] ? (rows[0] as HTMLElement).offsetHeight : 48
    drag.current = { from: index, startY: e.clientY, rowH, moved: false }
    setDragIdx(index)

    const onMove = (ev: PointerEvent) => {
      const d = drag.current
      const delta = Math.round((ev.clientY - d.startY) / d.rowH)
      const target = Math.max(0, Math.min(slotsRef.current.length - 1, d.from + delta))
      if (target !== d.from) {
        setSlots((prev) => {
          const next = [...prev]
          const [item] = next.splice(d.from, 1)
          next.splice(target, 0, item)
          return next
        })
        setDragIdx(target)
        d.startY += (target - d.from) * d.rowH
        d.from = target
        d.moved = true
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragIdx(null)
      if (drag.current.moved) persistOrder()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Keep a ref of slots for the window-level drag listeners
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  function persistOrder() {
    const current = slotsRef.current
    const renumbered = current.map((g, i) => (g ? { ...g, goal_number: i + 1 } : null))
    setSlots(renumbered)
    const filled = renumbered.filter((g): g is GoalRow => g !== null)
    run(() =>
      reorderGoals(
        game.id,
        filled.map((g) => g.id),
        filled.map((g) => g.goal_number)
      )
    )
  }

  // ── Cards ──
  const consolidated = consolidateCards(cards).sort((a, b) =>
    nameOf(a.player_id).localeCompare(nameOf(b.player_id))
  )

  function handleAddCard() {
    if (!cardPlayer) return
    run(async () => {
      const row = await addCard(game.id, cardPlayer, cardType)
      setCards((prev) => [...prev, row])
      setCardPlayer('')
      setCardType('green')
      setAddingCard(false)
    })
  }

  function handleRemoveCard(playerId: string, type: CardRow['card_type']) {
    const row = [...cards].reverse().find((c) => c.player_id === playerId && c.card_type === type)
    if (!row) return
    setCards((prev) => prev.filter((c) => c.id !== row.id))
    run(() => removeCard(row.id))
  }

  const hasScore = score.gf != null && score.ga != null

  // Group POTM placings (1st/2nd/3rd), sharing a place on ties.
  const potmByPlace = [1, 2, 3]
    .map((place) => ({
      place,
      names: potm.filter((p) => p.place === place).map((p) => nameOf(p.player_id)),
    }))
    .filter((row) => row.names.length > 0)

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto scrollbar-hide rounded-t-2xl border border-surface-border bg-surface-card px-6 pb-8 pt-6 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Match Result</h2>
          <span className="text-xs text-slate-400">vs {game.opponent}</span>
        </div>

        {/* Score */}
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-center gap-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="w-16 text-center">Us</span>
            <span className="w-4" />
            <span className="w-16 text-center">{game.opponent}</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <input
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              value={gfInput}
              onChange={(e) => setGfInput(e.target.value)}
              className="w-16 rounded-lg border border-surface-border bg-surface py-2 text-center text-2xl font-bold text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <span className="text-xl font-bold text-slate-500">–</span>
            <input
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              value={gaInput}
              onChange={(e) => setGaInput(e.target.value)}
              className="w-16 rounded-lg border border-surface-border bg-surface py-2 text-center text-2xl font-bold text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          {scoreChanged && (
            <button
              type="button"
              onClick={handleSaveScore}
              disabled={busy || !scoreValid}
              className="bg-accent mt-3 w-full rounded-lg py-2 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save score'}
            </button>
          )}
        </div>

        {/* POTM — result from the vote-POTM system (#5), shown once the poll closes */}
        <div className="mb-5 border-b border-white/5 pb-4 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Player of the Match</div>
          {potmByPlace.length === 0 ? (
            <div className="mt-0.5 text-xs text-slate-600">To be decided</div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {potmByPlace.map(({ place, names }) => (
                <div key={place} className="text-xs">
                  <span className={`font-bold ${POTM_PLACE_CLS[place]}`}>{POTM_PLACE_LABEL[place]}</span>{' '}
                  <span className="text-white">{names.join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scorers */}
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Scorers</h3>
          {!hasScore && (
            <p className="text-xs text-slate-500">Enter the final score above to record scorers.</p>
          )}
          {hasScore && slots.length === 0 && (
            <p className="text-xs text-slate-500">No goals scored.</p>
          )}
          <div ref={listRef} className="space-y-1">
            {slots.map((g, i) => (
              <div
                key={g ? g.id : `blank-${i}`}
                data-slot-row
                className={`flex items-center gap-2 rounded-lg px-1 py-1 transition-colors ${
                  dragIdx === i ? 'bg-brand/15 ring-1 ring-brand/30' : ''
                }`}
              >
                <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-500">{i + 1}</span>
                <select
                  value={g?.scorer_id ?? ''}
                  onChange={(e) => handleScorerChange(i, e.target.value)}
                  disabled={busy}
                  className={`${selectCls} min-w-0 flex-1`}
                >
                  <option value="">— scorer —</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{preferredName(p)}</option>
                  ))}
                </select>
                <select
                  value={assistValue(g)}
                  onChange={(e) => handleAssistChange(i, e.target.value)}
                  disabled={busy || !g}
                  className={`${selectCls} min-w-0 flex-1`}
                >
                  <option value="">— assist —</option>
                  <option value="pc">PC</option>
                  <option value="ps">PS</option>
                  {players
                    .filter((p) => p.id !== g?.scorer_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{preferredName(p)}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onPointerDown={(e) => handleDragStart(i, e)}
                  disabled={!g}
                  aria-label="Drag to reorder"
                  className={`shrink-0 cursor-grab touch-none px-1 py-1 text-sm active:cursor-grabbing ${
                    g ? 'text-slate-500 hover:text-white' : 'text-slate-800'
                  }`}
                >
                  ≡
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cards — consolidated, bottom of the result view */}
        <div className="mb-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Cards</h3>
          {consolidated.length === 0 && !addingCard && (
            <p className="mb-2 text-xs text-slate-500">No cards.</p>
          )}
          <div className="space-y-0.5">
            {consolidated.map((c) => (
              <div key={`${c.player_id}-${c.card_type}`} className="flex items-center gap-2 rounded-lg px-1 py-1">
                <span className="min-w-0 flex-1 truncate text-sm text-white">{nameOf(c.player_id)}</span>
                <span className="inline-flex items-center gap-0.5 text-xs">
                  <span className={CARD_SHAPES[c.card_type].cls}>{CARD_SHAPES[c.card_type].shape}</span>
                  <span className="text-slate-400">{c.count}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCard(c.player_id, c.card_type)}
                  disabled={busy}
                  aria-label="Remove one card"
                  className="shrink-0 px-1 text-xs text-slate-600 transition hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {addingCard ? (
            <div className="mt-2 flex items-center gap-2">
              <select
                value={cardPlayer}
                onChange={(e) => setCardPlayer(e.target.value)}
                disabled={busy}
                className={`${selectCls} min-w-0 flex-1`}
              >
                <option value="">— player —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{preferredName(p)}</option>
                ))}
              </select>
              <select
                value={cardType}
                onChange={(e) => setCardType(e.target.value as CardRow['card_type'])}
                disabled={busy}
                className={`${selectCls} w-24 shrink-0`}
              >
                {(Object.keys(CARD_SHAPES) as CardRow['card_type'][]).map((t) => (
                  <option key={t} value={t}>{CARD_SHAPES[t].label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddCard}
                disabled={busy || !cardPlayer}
                className="bg-accent shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCard(true)}
              className="mt-2 w-full rounded-lg border border-surface-border py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
            >
              + Card
            </button>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-surface-border py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-700"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function buildSlots(goals: GoalRow[], goalsFor: number): (GoalRow | null)[] {
  // One slot per goal we scored; keep any stray rows beyond the score visible so they can be fixed
  const maxNumber = goals.reduce((m, g) => Math.max(m, g.goal_number), 0)
  const count = Math.max(goalsFor, maxNumber)
  const slots: (GoalRow | null)[] = Array.from({ length: count }, () => null)
  for (const g of goals) slots[g.goal_number - 1] = g
  return slots
}

export function consolidateCards(cards: CardRow[]) {
  const groups = new Map<string, { player_id: string; card_type: CardRow['card_type']; count: number }>()
  for (const c of cards) {
    const key = `${c.player_id}-${c.card_type}`
    const g = groups.get(key)
    if (g) g.count += 1
    else groups.set(key, { player_id: c.player_id, card_type: c.card_type, count: 1 })
  }
  return Array.from(groups.values())
}
