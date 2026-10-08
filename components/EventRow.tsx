import { fmtReport, fmtTimeRange, dateBlock } from '@/lib/format'
import { GAME_TYPE_LABEL, gameTitle } from '@/lib/constants'
import type { Game, Training, TeamEvent } from '@/components/EventDetailModal'

export type EventItem =
  | { kind: 'game'; date: string; game: Game }
  | { kind: 'training'; date: string; training: Training }
  | { kind: 'event'; date: string; event: TeamEvent }

/** The schedule row's id (games, trainings and events each have their own table) */
export function eventId(item: EventItem) {
  return item.kind === 'game' ? item.game.id : item.kind === 'training' ? item.training.id : item.event.id
}

/** "ORA vs Opponent", "Training", or the event's own title */
export function eventTitle(item: EventItem) {
  return item.kind === 'game' ? gameTitle(item.game.opponent) : item.kind === 'training' ? 'Training' : item.event.title
}

export function eventLocation(item: EventItem) {
  return item.kind === 'game' ? item.game.location : item.kind === 'training' ? item.training.location : item.event.location
}

/** Optional end time (ISO) */
export function eventEnd(item: EventItem) {
  return (item.kind === 'game' ? item.game.ends_at : item.kind === 'training' ? item.training.ends_at : item.event.ends_at) ?? null
}

/** Optional "report early by" minutes */
export function eventReportMinutes(item: EventItem) {
  return (
    (item.kind === 'game' ? item.game.report_minutes : item.kind === 'training' ? item.training.report_minutes : item.event.report_minutes) ??
    null
  )
}

/** Reply deadline (null = none) */
export function eventRespondBy(item: EventItem) {
  return (item.kind === 'game' ? item.game.respond_by : item.kind === 'training' ? item.training.respond_by : item.event.respond_by) ?? null
}

/** Whether a late or missing reply is fined */
export function eventFinesEnabled(item: EventItem) {
  return (item.kind === 'game' ? item.game.fines_enabled : item.kind === 'training' ? item.training.fines_enabled : item.event.fines_enabled) ?? false
}

export function eventNotes(item: EventItem) {
  return item.kind === 'game' ? item.game.notes : item.kind === 'training' ? item.training.notes : item.event.notes
}

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
 * One event row: date block, title/time/location, and on the right the result
 * badge for finished games and/or the headcount. Shared by both schedule screens;
 * admin passes `attending` (headcounts — "10 attending", or "14 attended" when
 * `past`), players pass `mine` (their own RSVP status, as a sub-line). Callers
 * pass at most one.
 */
export function EventRow({
  item,
  attending,
  mine,
  past = false,
}: {
  item: EventItem
  attending?: Record<string, number>
  mine?: MyStatus
  /** Already happened: the headcount reads "attended" */
  past?: boolean
}) {
  const isGame = item.kind === 'game'
  const id = eventId(item)
  const location = eventLocation(item)
  const report = fmtReport(item.date, eventReportMinutes(item))
  const block = dateBlock(item.date)
  const going = attending ? attending[id] ?? 0 : null
  const result = isGame ? item.game.result : null

  return (
    <div className="liga-event-row flex w-full items-center gap-3">
      <div className="liga-event-date flex w-11 shrink-0 flex-col items-center justify-center leading-tight">
        <span className="liga-event-date-day text-xl font-bold text-white">{block.day}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{block.mon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="liga-event-title break-words text-lg font-semibold leading-snug text-white">
            {eventTitle(item)}
          </span>
          {isGame && item.game.game_type !== 'regular' && (
            <span className="liga-event-type rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
              {GAME_TYPE_LABEL[item.game.game_type] ?? item.game.game_type}
            </span>
          )}
          {item.kind === 'event' && (
            <span className="liga-event-type rounded bg-sky-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
              Event
            </span>
          )}
        </div>
        <div className="liga-event-meta mt-0.5 text-xs text-slate-400">
          {fmtTimeRange(item.date, eventEnd(item))}
          {location && ` · ${location}`}
          {isGame && item.game.home_away && ` · ${item.game.home_away === 'home' ? 'Home' : 'Away'}`}
        </div>
        {/* Report-early time — subtext under the date & time */}
        {report && <div className="liga-event-report mt-0.5 text-[11px] text-slate-500">{report}</div>}
        {mine && (
          <div className={`mt-0.5 text-[11px] ${STATUS_CHIP[mine].cls}`}>{STATUS_CHIP[mine].label}</div>
        )}
      </div>

      {(result || going != null) && (
        <div className="liga-event-side flex shrink-0 flex-col items-end gap-1 text-right">
          {isGame && result && (
            <div className="liga-event-result flex items-center gap-1.5">
              <span className={`liga-result-badge rounded px-1.5 py-0.5 text-xs font-bold ${RESULT_BADGE[result]?.cls ?? 'bg-slate-700 text-slate-300'}`}>
                {RESULT_BADGE[result]?.label ?? result}
              </span>
              <span className="liga-event-score text-sm font-semibold text-white">
                {item.game.goals_for}–{item.game.goals_against}
              </span>
            </div>
          )}
          {/* Headcount: a number you can read at a glance, but quieter than the title */}
          {going != null && (
            <div className="liga-event-count leading-none">
              <div className={`liga-event-count-value font-semibold tabular-nums text-slate-200 ${result ? 'text-sm' : 'text-base'}`}>{going}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{past ? 'attended' : 'attending'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
