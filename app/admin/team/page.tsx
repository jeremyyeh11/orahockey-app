import { createClient } from '@/lib/supabase/server'
import TeamClient from './TeamClient'

export default async function AdminTeamPage() {
  const supabase = createClient()

  const { data: players, error } = await supabase
    .from('players')
    .select('id, full_name, email, jersey_number, position, role, is_active, auth_user_id')
    .order('jersey_number', { ascending: true, nullsFirst: false })
    .order('full_name', { ascending: true })

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-400 text-sm">Error loading players: {error.message}</p>
      </div>
    )
  }

  return <TeamClient players={players ?? []} />
}
