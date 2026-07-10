import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function AdminProfilePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: player } = await supabase
    .from('players')
    .select('full_name, email, role, jersey_number, position')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const name = player?.full_name ?? 'Unknown'
  const email = player?.email ?? user?.email ?? '—'
  const role = player?.role ?? 'player'
  const positions = Array.isArray(player?.position) ? player!.position : []

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-white">Profile</h1>

      {/* Identity card */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="bg-accent flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-xl font-bold text-white ring-1 ring-white/10">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold text-white">{name}</div>
            <div className="truncate text-sm text-slate-400">{email}</div>
            <span className="mt-1.5 inline-block rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-brand-light">
              {role}
            </span>
          </div>
        </div>

        {(player?.jersey_number != null || positions.length > 0) && (
          <div className="mt-5 flex gap-6 border-t border-white/10 pt-4 text-sm">
            {player?.jersey_number != null && (
              <div>
                <div className="text-slate-500">Jersey</div>
                <div className="font-semibold text-white">
                  #{player.jersey_number}
                </div>
              </div>
            )}
            {positions.length > 0 && (
              <div>
                <div className="text-slate-500">Position</div>
                <div className="font-semibold text-white">
                  {positions.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4">
        <SignOutButton />
      </div>
    </div>
  )
}
