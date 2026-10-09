import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import PollsClient from '@/components/PollsClient'
import { POLL_SELECT } from '@/lib/polls'
import { getPotmPolls } from '@/lib/potm'
import { getSeasonSquad, getSeasons, seasonRoster } from '@/lib/season-server'
import { loadFines } from '@/lib/fines-server'
import { finedBySession } from '@/lib/fines'
import { getNow } from '@/lib/preview'

/**
 * Shared loader + render for the Polls tab. Used by both the admin and player
 * `polls` routes; `basePath` '/admin' turns on poll management.
 */
export async function PollsView({ basePath }: { basePath: '/dashboard' | '/admin' }) {
  const supabase = createClient()

  const user = await getRequestUser()

  // Polls aren't season-scoped: who should vote is the current season's active squad
  const seasons = await getSeasons()
  const current = seasons.find((s) => s.is_current) ?? seasons[0]

  const [{ data: me }, { data: polls, error }, { polls: potmPolls }, squad, { fines }] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    supabase
      .from('polls')
      .select(POLL_SELECT)
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

  return (
    <PollsClient
      polls={polls ?? []}
      potmPolls={potmPolls}
      myPlayerId={me?.id ?? null}
      now={getNow().toISOString()}
      roster={seasonRoster(squad, false)}
      fined={finedBySession(fines)}
      isAdmin={basePath === '/admin'}
    />
  )
}
