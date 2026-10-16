// Cancelled / postponed schedule entries (038_cancelled_events.sql). Admins
// cancel a game, training or team event, or postpone a game, instead of
// deleting it: it stays on the schedule but counts for nothing — no
// appearances, attendance %, fines or POTM.

export type EventKind = 'game' | 'training' | 'event'

/** Games can be postponed; trainings and team events only cancelled */
export type EventStatus = 'scheduled' | 'cancelled' | 'postponed'

/** Longest "why" (status_reason) */
export const STATUS_REASON_MAX = 200

/** What the squad sees on a cancelled/postponed entry */
export const STATUS_LABEL: Record<Exclude<EventStatus, 'scheduled'>, string> = {
  cancelled: 'Cancelled',
  postponed: 'Postponed',
}

/** Still on: counts for attendance, appearances, fines and POTM (a missing status is a pre-038 row) */
export const isScheduled = (e: { status?: string | null }) => !e.status || e.status === 'scheduled'
