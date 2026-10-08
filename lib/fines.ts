// Fines for late replies and last-minute changes — pure rules, no React or
// Supabase, shared by server pages and client forms. Fines are never stored:
// they're derived from each entry's respond-by, the RSVP history
// (attendance_log), poll votes and admin waivers. See 018_fines.sql.
import { toDatetimeLocal } from '@/lib/format'

/** Dollars per fine */
export const FINE_AMOUNT = 5

/** Changing your RSVP this close to the start (without telling the coaching committee) is fined */
export const LATE_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000

const HOUR = 60 * 60 * 1000

export type FineKind = 'game' | 'training' | 'event' | 'poll'
export type FineReason = 'late_reply' | 'late_change'
export type RsvpStatus = 'attending' | 'not_attending' | 'maybe'

// ── Respond-by ──────────────────────────────────────────────

/** 'YYYY-MM-DD' of an instant, in Singapore */
const sgYmd = (iso: string) => toDatetimeLocal(iso).slice(0, 10)
/** ISO weekday (Mon 1 … Sun 7) of a 'YYYY-MM-DD' */
const isoWeekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7
function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
/** 23:59:59 Singapore time on that day */
const endOfSgDay = (ymd: string) => new Date(`${ymd}T23:59:59+08:00`).toISOString()

/**
 * The club's default reply deadline (Singapore time):
 *  - weekend (Sat/Sun) game or training → the Thursday before, 23:59
 *  - weekday training                   → the Sunday before, 23:59
 *  - weekday game                       → 72 hours before the start
 *  - team event / poll                  → 72 hours after posting, but no later
 *                                         than the start (event) or close (poll)
 * Mirrored by the backfill in 018_fines.sql.
 */
export function defaultRespondBy(
  kind: FineKind,
  { start, postedAt, closesAt }: { start?: string | null; postedAt: Date; closesAt?: string | null }
): string | null {
  if (kind === 'event' || kind === 'poll') {
    const cap = kind === 'event' ? start : closesAt
    const due = postedAt.getTime() + 72 * HOUR
    return new Date(cap ? Math.min(due, new Date(cap).getTime()) : due).toISOString()
  }
  if (!start) return null
  const day = sgYmd(start)
  const weekday = isoWeekday(day)
  if (weekday >= 6) return endOfSgDay(addDays(day, 4 - weekday))
  if (kind === 'training') return endOfSgDay(addDays(day, -weekday))
  return new Date(new Date(start).getTime() - 72 * HOUR).toISOString()
}

/**
 * Fines on for a new entry? Team events start off (casual by default). Anything
 * posted after its own deadline is fine-free ("no fines for late-added events").
 */
export function defaultFinesEnabled(kind: FineKind, respondBy: string | null, postedAt: Date) {
  if (kind === 'event' || !respondBy) return false
  return new Date(respondBy).getTime() > postedAt.getTime()
}

// ── Fines ───────────────────────────────────────────────────

/** A game, training, team event or poll that can carry fines */
export type FineEntry = {
  kind: FineKind
  id: string
  title: string
  /** Start time — null for polls */
  start: string | null
  respondBy: string | null
  finesEnabled: boolean
  /** Players expected to reply (the squad with app accounts) */
  expected: string[]
}

/** One attendance_log row */
export type RsvpChange = {
  player_id: string
  session_id: string
  session_type: 'game' | 'training' | 'event'
  status: RsvpStatus
  previous_status: RsvpStatus | null
  changed_at: string
  /** auth user who made the change */
  changed_by: string | null
}

export type PollVote = { poll_id: string; player_id: string; voted_at: string }

export type FineWaiver = { player_id: string; item_type: FineKind; item_id: string; reason: FineReason }

export type Fine = {
  playerId: string
  kind: FineKind
  itemId: string
  title: string
  reason: FineReason
  /** When the fine happened: the deadline passing (late reply) or the change (late change) */
  at: string
  /** Late reply: when they did reply (null = never) */
  repliedAt?: string | null
  /** Late change: what changed */
  from?: RsvpStatus
  to?: RsvpStatus
  waived: boolean
}

export const fineKey = (f: { playerId: string; kind: FineKind; itemId: string; reason: FineReason }) =>
  `${f.playerId}|${f.kind}|${f.itemId}|${f.reason}`

/**
 * Every fine as of `now`:
 *  - late reply: an expected player's first reply (RSVP or poll vote) came after
 *    the respond-by, or never came — once the respond-by has passed
 *  - late change: a player changed their own RSVP within 24h of the start (one
 *    fine per event, at the first such change). The coaching committee can't be
 *    seen from here, so admins waive the ones who told them.
 * Entries with fines off or no respond-by never fine. `authIdOf` maps a player
 * to their auth user, so changes someone else made aren't held against them.
 */
export function computeFines({
  entries,
  changes,
  votes,
  waivers,
  authIdOf,
  now,
}: {
  entries: FineEntry[]
  changes: RsvpChange[]
  votes: PollVote[]
  waivers: FineWaiver[]
  authIdOf: (playerId: string) => string | null
  now: Date
}): Fine[] {
  const waived = new Set(waivers.map((w) => fineKey({ playerId: w.player_id, kind: w.item_type, itemId: w.item_id, reason: w.reason })))
  const nowMs = now.getTime()

  const firstReply = new Map<string, string>()
  const remember = (key: string, at: string) => {
    const prev = firstReply.get(key)
    if (!prev || new Date(at).getTime() < new Date(prev).getTime()) firstReply.set(key, at)
  }
  for (const c of changes) remember(`${c.session_type}|${c.session_id}|${c.player_id}`, c.changed_at)
  for (const v of votes) remember(`poll|${v.poll_id}|${v.player_id}`, v.voted_at)

  const changesBySession = new Map<string, RsvpChange[]>()
  for (const c of changes) {
    const key = `${c.session_type}|${c.session_id}`
    changesBySession.set(key, [...(changesBySession.get(key) ?? []), c])
  }

  const fines: Fine[] = []
  const add = (f: Omit<Fine, 'waived'>) => fines.push({ ...f, waived: waived.has(fineKey(f)) })

  for (const e of entries) {
    if (!e.finesEnabled || !e.respondBy) continue
    const dueMs = new Date(e.respondBy).getTime()

    if (dueMs <= nowMs) {
      for (const playerId of e.expected) {
        const replied = firstReply.get(`${e.kind}|${e.id}|${playerId}`) ?? null
        if (!replied || new Date(replied).getTime() > dueMs) {
          add({ playerId, kind: e.kind, itemId: e.id, title: e.title, reason: 'late_reply', at: e.respondBy, repliedAt: replied })
        }
      }
    }

    if (e.kind === 'poll' || !e.start) continue
    const startMs = new Date(e.start).getTime()
    const fined = new Set<string>()
    const late = (changesBySession.get(`${e.kind}|${e.id}`) ?? [])
      .filter((c) => {
        const t = new Date(c.changed_at).getTime()
        return (
          c.previous_status !== null &&
          c.previous_status !== c.status &&
          t >= startMs - LATE_CHANGE_WINDOW_MS &&
          t < startMs &&
          t <= nowMs &&
          c.changed_by !== null &&
          c.changed_by === authIdOf(c.player_id)
        )
      })
      .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
    for (const c of late) {
      if (fined.has(c.player_id)) continue
      fined.add(c.player_id)
      add({ playerId: c.player_id, kind: e.kind, itemId: e.id, title: e.title, reason: 'late_change', at: c.changed_at, from: c.previous_status!, to: c.status })
    }
  }

  return fines.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

/** 'YYYY-MM' (Singapore) a fine counts towards */
export const fineMonth = (f: Pick<Fine, 'at'>) => sgYmd(f.at).slice(0, 7)

/** Unwaived fines per player, most owed first: [{ playerId, count, total, fines }] */
export function finesByPlayer(fines: Fine[]) {
  const by = new Map<string, Fine[]>()
  for (const f of fines) by.set(f.playerId, [...(by.get(f.playerId) ?? []), f])
  return Array.from(by, ([playerId, list]) => {
    const count = list.filter((f) => !f.waived).length
    return { playerId, count, total: count * FINE_AMOUNT, fines: list }
  }).sort((a, b) => b.total - a.total)
}
