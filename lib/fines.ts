// Fines for late replies and last-minute changes — pure rules, no React or
// Supabase, shared by server pages and client forms. Fines are never stored:
// they're derived from each entry's respond-by, the RSVP history
// (attendance_log), poll votes and admin waivers. See 018_fines.sql.
import { toDatetimeLocal } from '@/lib/format'

/** Dollars per fine */
export const FINE_AMOUNT = 5

/**
 * Changing your RSVP this close to the start (without telling the coaching
 * committee) is fined — and "Update later" must be settled before it starts
 */
export const LATE_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000

const HOUR = 60 * 60 * 1000

export type FineKind = 'game' | 'training' | 'event' | 'poll'

/** What players call each kind in fine wording: "24h before the match" */
export const FINE_KIND_NOUN: Record<FineKind, string> = { game: 'match', training: 'training', event: 'event', poll: 'poll' }
export type FineReason = 'late_reply' | 'late_change'
export type RsvpStatus = 'attending' | 'not_attending' | 'maybe'

/** What players see for each RSVP answer ('maybe' is stored, "Update later" is shown) */
export const RSVP_LABEL: Record<RsvpStatus, string> = { attending: "I'm in", maybe: 'Update later', not_attending: 'Out' }

/** Longest "why I'm out" (attendance.reason, 033) */
export const OUT_REASON_MAX = 200

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

export type FineWaiver = { player_id: string; item_type: FineKind; item_id: string; reason: FineReason; note?: string | null }
export type FinePayment = { player_id: string; item_type: FineKind; item_id: string; reason: FineReason; paid_at: string }

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
  /** Late reply: still on "Update later" when a final answer was due (`at`) */
  undecided?: boolean
  /** Late change: what changed */
  from?: RsvpStatus
  to?: RsvpStatus
  /** Excused by an admin (with their reason) — costs nothing */
  waived: boolean
  waiveNote?: string | null
  /** Marked paid by an admin */
  paid: boolean
  paidAt?: string | null
}

/** Neither paid nor waived */
export const isOutstanding = (f: Pick<Fine, 'waived' | 'paid'>) => !f.waived && !f.paid

export const fineKey = (f: { playerId: string; kind: FineKind; itemId: string; reason: FineReason }) =>
  `${f.playerId}|${f.kind}|${f.itemId}|${f.reason}`

/**
 * Every fine as of `now` — at most one per player per entry:
 *  - late reply: an expected player's first reply (RSVP or poll vote) came after
 *    the respond-by, or never came — once the respond-by has passed
 *  - still on "Update later" (also a late reply): "Update later" isn't a final
 *    answer, so a player on it when the respond-by passes gets until 24h before
 *    the start to say I'm in or Out. Anyone still on it then is fined — including
 *    anyone who switched to it after the respond-by. If the respond-by is already
 *    inside those 24h, there's no extra time.
 *  - late change: a player changed their own RSVP within 24h of the start (at the
 *    first such change). The coaching committee can't be seen from here, so admins
 *    waive the ones who told them.
 * Entries with fines off or no respond-by never fine. `authIdOf` maps a player
 * to their auth user, so changes someone else made aren't held against them.
 */
export function computeFines({
  entries,
  changes,
  votes,
  waivers,
  payments = [],
  authIdOf,
  now,
}: {
  entries: FineEntry[]
  changes: RsvpChange[]
  votes: PollVote[]
  waivers: FineWaiver[]
  payments?: FinePayment[]
  authIdOf: (playerId: string) => string | null
  now: Date
}): Fine[] {
  const keyOf = (r: { player_id: string; item_type: FineKind; item_id: string; reason: FineReason }) =>
    fineKey({ playerId: r.player_id, kind: r.item_type, itemId: r.item_id, reason: r.reason })
  const waived = new Map(waivers.map((w) => [keyOf(w), w.note ?? null]))
  const paid = new Map(payments.map((p) => [keyOf(p), p.paid_at]))
  const nowMs = now.getTime()
  const ms = (iso: string) => new Date(iso).getTime()

  const firstReply = new Map<string, string>()
  const remember = (key: string, at: string) => {
    const prev = firstReply.get(key)
    if (!prev || ms(at) < ms(prev)) firstReply.set(key, at)
  }
  for (const c of changes) remember(`${c.session_type}|${c.session_id}|${c.player_id}`, c.changed_at)
  for (const v of votes) remember(`poll|${v.poll_id}|${v.player_id}`, v.voted_at)

  // Each session's RSVP history, oldest first
  const changesBySession = new Map<string, RsvpChange[]>()
  for (const c of [...changes].sort((a, b) => ms(a.changed_at) - ms(b.changed_at))) {
    const key = `${c.session_type}|${c.session_id}`
    changesBySession.set(key, [...(changesBySession.get(key) ?? []), c])
  }
  /** A player's answer as it stood at `atMs` (null = no reply yet) */
  const statusAt = (history: RsvpChange[], playerId: string, atMs: number) => {
    let status: RsvpStatus | null = null
    for (const c of history) {
      if (ms(c.changed_at) > atMs) break
      if (c.player_id === playerId) status = c.status
    }
    return status
  }

  const fines: Fine[] = []
  const add = (f: Omit<Fine, 'waived' | 'waiveNote' | 'paid' | 'paidAt'>) => {
    const key = fineKey(f)
    fines.push({ ...f, waived: waived.has(key), waiveNote: waived.get(key) ?? null, paid: paid.has(key), paidAt: paid.get(key) ?? null })
  }

  for (const e of entries) {
    if (!e.finesEnabled || !e.respondBy) continue
    const dueMs = ms(e.respondBy)
    const history = changesBySession.get(`${e.kind}|${e.id}`) ?? []
    const startMs = e.kind === 'poll' || !e.start ? null : ms(e.start)
    // "Update later" must turn into I'm in or Out by 24h before the start (or the respond-by, if later)
    const decideByMs = startMs === null ? null : Math.max(dueMs, startMs - LATE_CHANGE_WINDOW_MS)
    const fined = new Set<string>()

    for (const playerId of dueMs <= nowMs ? e.expected : []) {
      const replied = firstReply.get(`${e.kind}|${e.id}|${playerId}`) ?? null
      if (!replied || ms(replied) > dueMs) {
        fined.add(playerId)
        add({ playerId, kind: e.kind, itemId: e.id, title: e.title, reason: 'late_reply', at: e.respondBy, repliedAt: replied })
      } else if (decideByMs !== null && decideByMs <= nowMs && statusAt(history, playerId, decideByMs) === 'maybe') {
        fined.add(playerId)
        add({ playerId, kind: e.kind, itemId: e.id, title: e.title, reason: 'late_reply', at: new Date(decideByMs).toISOString(), repliedAt: replied, undecided: true })
      }
    }

    if (startMs === null) continue
    for (const c of history) {
      if (fined.has(c.player_id)) continue
      const t = ms(c.changed_at)
      if (
        c.previous_status !== null &&
        c.previous_status !== c.status &&
        t >= startMs - LATE_CHANGE_WINDOW_MS &&
        t < startMs &&
        t <= nowMs &&
        c.changed_by !== null &&
        c.changed_by === authIdOf(c.player_id)
      ) {
        fined.add(c.player_id)
        add({ playerId: c.player_id, kind: e.kind, itemId: e.id, title: e.title, reason: 'late_change', at: c.changed_at, from: c.previous_status, to: c.status })
      }
    }
  }

  return fines.sort((a, b) => ms(a.at) - ms(b.at))
}

/** Unwaived fines per entry ('training-<id>', 'poll-<id>') and player — attendance and voter lists mark them */
export function finedBySession(fines: Fine[]) {
  const by: Record<string, Record<string, FineReason[]>> = {}
  for (const f of fines) {
    if (f.waived) continue
    const forEntry = (by[`${f.kind}-${f.itemId}`] ??= {})
    ;(forEntry[f.playerId] ??= []).push(f.reason)
  }
  return by
}

/** 'YYYY-MM' (Singapore) a fine counts towards */
export const fineMonth = (f: Pick<Fine, 'at'>) => sgYmd(f.at).slice(0, 7)

/**
 * Fines per player, most owed first: `count`/`total` are what's still outstanding
 * (neither paid nor waived); `settled` once every fine is paid or waived.
 */
export function finesByPlayer(fines: Fine[]) {
  const by = new Map<string, Fine[]>()
  for (const f of fines) by.set(f.playerId, [...(by.get(f.playerId) ?? []), f])
  return Array.from(by, ([playerId, list]) => {
    const count = list.filter(isOutstanding).length
    return {
      playerId,
      count,
      total: count * FINE_AMOUNT,
      paid: list.filter((f) => f.paid && !f.waived).length,
      waived: list.filter((f) => f.waived).length,
      settled: count === 0,
      fines: list,
    }
  }).sort((a, b) => b.total - a.total)
}

/** Where a fine's entry lives in the app: the event on the schedule, or the Polls tab */
export function fineHref(basePath: '/dashboard' | '/admin', f: { kind: FineKind; itemId: string }) {
  return f.kind === 'poll' ? `${basePath}/polls` : `${basePath}/schedule?event=${f.kind}-${f.itemId}`
}

/** 'YYYY-MM' (Singapore) of an instant — the fines month it falls in */
export const sgMonth = (d: Date) => sgYmd(d.toISOString()).slice(0, 7)

/** 'October 2026' */
export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1))
}

/** The month before / after 'YYYY-MM' */
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}
