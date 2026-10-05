import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import SignOutButton from '@/components/SignOutButton'

export const metadata: Metadata = { title: 'Profile' }

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function AdminProfilePage() {
  const supabase = createClient()

  const user = await getRequestUser()

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
    <div className="liga-page liga-profile p-4">
      <div className="liga-page-header mb-4">
        <h1 className="liga-page-title text-white">Profile</h1>
      </div>

      {/* Identity card */}
      <div className="liga-profile-card card p-6">
        <div className="flex items-center gap-4">
          <div className="liga-avatar bg-accent flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-xl font-bold text-white ring-1 ring-white/10">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold text-white">{name}</div>
            <div className="truncate text-sm text-slate-400">{email}</div>
            <span className="liga-role-label mt-1.5 inline-block text-xs font-semibold capitalize text-brand-light">
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
