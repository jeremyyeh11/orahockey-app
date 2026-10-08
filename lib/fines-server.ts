import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getNow } from '@/lib/preview'
import { getSeasons } from '@/lib/season-server'
import { gameTitle } from '@/lib/constants'
import { fmtDate } from '@/lib/format'
import { computeFines, type Fine, type FineEntry, type FinePayment, type FineWaiver, type PollVote, type RsvpChange } from '@/lib/fines'

export type FinePlayer = { id: string; full_name: string; preferred_name: string | null }

type SquadRow = {
  season_id: string
  player: { id: string; full_name: string; preferred_name: string | null; is_active: boolean; auth_user_id: string | null }
}

/**
 * Every fine (see computeFines), plus the players they belong to. Expected to
 * reply: a season's squad members who are active and have an app account —
 * nobody else can reply in the app. Polls aren't season-scoped: their squad is
 * the season they were posted in (else the current one). Deduped per request.
 */
export const loadFines = cache(async (): Promise<{ fines: Fine[]; players: Map<string, FinePlayer> }> => {
  const supabase = createClient()
  const [seasons, { data: games }, { data: trainings }, { data: events }, { data: polls }, { data: squads }, { data: waivers }, { data: payments }] =
    await Promise.all([
      getSeasons(),
      supabase.from('games').select('id, season_id, opponent, game_date, respond_by').eq('fines_enabled', true).not('respond_by', 'is', null),
      supabase.from('training_sessions').select('id, season_id, session_date, respond_by').eq('fines_enabled', true).not('respond_by', 'is', null),
      supabase.from('team_events').select('id, season_id, title, event_date, respond_by').eq('fines_enabled', true).not('respond_by', 'is', null),
      supabase.from('polls').select('id, question, created_at, respond_by').eq('fines_enabled', true).not('respond_by', 'is', null),
      supabase.from('season_players').select('season_id, player:players!inner(id, full_name, preferred_name, is_active, auth_user_id)'),
      supabase.from('fine_waivers').select('player_id, item_type, item_id, reason, note'),
      supabase.from('fine_payments').select('player_id, item_type, item_id, reason, paid_at'),
    ])

  const players = new Map<string, FinePlayer & { auth_user_id: string | null }>()
  const expectedBySeason = new Map<string, string[]>()
  for (const row of (squads ?? []) as unknown as SquadRow[]) {
    const p = row.player
    players.set(p.id, { id: p.id, full_name: p.full_name, preferred_name: p.preferred_name, auth_user_id: p.auth_user_id })
    if (p.is_active && p.auth_user_id) expectedBySeason.set(row.season_id, [...(expectedBySeason.get(row.season_id) ?? []), p.id])
  }
  const squadOf = (seasonId: string | null) => (seasonId ? expectedBySeason.get(seasonId) ?? [] : [])
  const current = seasons.find((s) => s.is_current) ?? seasons[0]
  const seasonOn = (iso: string) => {
    const day = iso.slice(0, 10)
    return seasons.find((s) => s.starts_on <= day && day <= s.ends_on)?.id ?? current?.id ?? null
  }

  const entries: FineEntry[] = [
    ...(games ?? []).map((g) => ({ kind: 'game' as const, id: g.id, title: `${gameTitle(g.opponent)} · ${fmtDate(g.game_date)}`, start: g.game_date, respondBy: g.respond_by, finesEnabled: true, expected: squadOf(g.season_id) })),
    ...(trainings ?? []).map((t) => ({ kind: 'training' as const, id: t.id, title: `Training · ${fmtDate(t.session_date)}`, start: t.session_date, respondBy: t.respond_by, finesEnabled: true, expected: squadOf(t.season_id) })),
    ...(events ?? []).map((e) => ({ kind: 'event' as const, id: e.id, title: `${e.title} · ${fmtDate(e.event_date)}`, start: e.event_date, respondBy: e.respond_by, finesEnabled: true, expected: squadOf(e.season_id) })),
    ...(polls ?? []).map((p) => ({ kind: 'poll' as const, id: p.id, title: `Poll: ${p.question}`, start: null, respondBy: p.respond_by, finesEnabled: true, expected: squadOf(seasonOn(p.created_at)) })),
  ]

  const sessionIds = entries.filter((e) => e.kind !== 'poll').map((e) => e.id)
  const pollIds = entries.filter((e) => e.kind === 'poll').map((e) => e.id)
  const [{ data: changes }, { data: votes }] = await Promise.all([
    sessionIds.length
      ? supabase.from('attendance_log').select('player_id, session_id, session_type, status, previous_status, changed_at, changed_by').in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    pollIds.length ? supabase.from('poll_votes').select('poll_id, player_id, voted_at').in('poll_id', pollIds) : Promise.resolve({ data: [] }),
  ])

  const fines = computeFines({
    entries,
    changes: (changes ?? []) as RsvpChange[],
    votes: (votes ?? []) as PollVote[],
    waivers: (waivers ?? []) as FineWaiver[],
    payments: (payments ?? []) as FinePayment[],
    authIdOf: (id) => players.get(id)?.auth_user_id ?? null,
    now: getNow(),
  })
  return { fines, players }
})
