import { createClient } from '@/lib/supabase/server'
import PollsClient from './PollsClient'
import { getNow } from '@/lib/preview'
import { getPotmPolls } from '@/lib/potm'

export default async function PlayerPollsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: me }, { data: polls, error }, { polls: potmPolls }] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    supabase
      .from('polls')
      .select(
        'id, question, is_active, closes_at, created_at, poll_options(id, label, sort_order), poll_votes(id, poll_option_id, player_id)'
      )
      .order('created_at', { ascending: false }),
    getPotmPolls(),
  ])

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Error loading polls: {error.message}</p>
      </div>
    )
  }

  return (
    <PollsClient
      polls={polls ?? []}
      potmPolls={potmPolls}
      myPlayerId={me?.id ?? null}
      now={getNow().toISOString()}
    />
  )
}
