import { createClient } from '@/lib/supabase/server'
import RosterList from '@/components/RosterList'

export default async function PlayerTeamPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: me }, { data: players, error }] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    supabase
      .from('players')
      .select('id, full_name, jersey_number, position, is_active')
      .eq('is_active', true)
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true }),
  ])

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Error loading team: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="mb-1 text-xl font-bold text-white">Team</h1>
      <p className="mb-4 text-sm text-slate-400">{players?.length ?? 0} players</p>
      <RosterList players={players ?? []} myPlayerId={me?.id ?? null} />
    </div>
  )
}
