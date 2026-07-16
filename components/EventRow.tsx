import { fmtTime, dateBlock } from '@/lib/format'
import type { Game, Training } from '@/components/EventDetailModal'

export type EventItem =
  | { kind: 'game'; date: string; game: Game }
  | { kind: 'training'; date: string; training: Training }

export type MyStatus = 'attending' | 'not_attending' | 'maybe'

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

/**
 * One event row: date block, title/time/location, an optional sub-line, and the
 * result badge for finished games. Shared by both schedule screens; the sub-line
 * varies — admin passes `attending` (a headcount), players pass `mine` (their own
 * RSVP status). Callers pass at most one.
 */
export function EventRow({
  item,
  attending,
  mine,
}: {
  item: EventItem
  attending?: Record<string, number>
  mine?: MyStatus
}) {
  const isGame = item.kind === 'game'
  const id = isGame ? item.game.id : item.training.id
  const block = dateBlock(item.date)
  const going = attending?.[id]

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
