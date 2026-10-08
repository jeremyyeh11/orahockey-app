import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import PollsClient from './PollsClient'
import { getPotmPolls } from '@/lib/potm'
import { getSeasonSquad, getSeasons, seasonRoster } from '@/lib/season-server'
import { loadFines } from '@/lib/fines-server'
import { finedBySession } from '@/lib/fines'
import { getNow } from '@/lib/preview'

export const metadata: Metadata = { title: 'Polls' }

export default async function AdminPollsPage() {
  const supabase = createClient()

  const user = await getRequestUser()

  // Polls aren't season-scoped: who should vote is the current season's active squad
  const seasons = await getSeasons()
  const current = seasons.find((s) => s.is_current) ?? seasons[0]

  const [{ data: me }, { data: polls, error }, { polls: potmPolls }, squad, { fines }] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    supabase
      .from('polls')
      .select(
        'id, question, is_active, closes_at, created_at, respond_by, fines_enabled, poll_options(id, label, sort_order), poll_votes(id, poll_option_id, player_id, voted_at)'
      )
      .order('created_at', { ascending: false }),
    getPotmPolls(),
    current ? getSeasonSquad(current.id) : Promise.resolve([]),
    loadFines(),
  ])

  if (error) {
    return (
      <div className="liga-page liga-error-state p-4">
        <p className="liga-alert liga-alert-error text-sm text-red-400">Error loading polls: {error.message}</p>
      </div>
    )
  }

  return <PollsClient polls={polls ?? []} potmPolls={potmPolls} myPlayerId={me?.id ?? null} now={getNow().toISOString()} roster={seasonRoster(squad, false)} fined={finedBySession(fines)} />
}
