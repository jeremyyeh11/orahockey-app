// Shared checks and cache refreshes for server actions. A plain module, not
// 'use server': every export of a 'use server' file becomes a callable
// endpoint, and these helpers must not be.

import { revalidatePath } from 'next/cache'
import type { createClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createClient>

/**
 * Throws unless the caller is an admin (the is_admin() SQL function). Every
 * admin action calls this first: RLS rejects most non-admin writes too, but an
 * update or delete it filters out fails silently, and the service-role client
 * (invites) skips RLS altogether.
 */
export async function requireAdmin(supabase: Supabase) {
  const { data, error } = await supabase.rpc('is_admin')
  if (error || data !== true) throw new Error('Only admins can do that.')
}

/**
 * The caller's players row id. Uses auth.getUser(), which asks the Auth
 * server, rather than the middleware header: mutations re-check the session.
 */
export async function requirePlayerId(supabase: Supabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data: me } = await supabase.from('players').select('id').eq('auth_user_id', user.id).single()
  if (!me) throw new Error('No player record is linked to this account.')
  return me.id
}

/** The club's team id (there's one team), or null if none exists yet */
export async function teamId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.from('teams').select('id').limit(1).single()
  return data?.id ?? null
}

export type Tab = 'home' | 'schedule' | 'polls' | 'team' | 'fines' | 'profile'

/**
 * Refresh tabs in both areas: every tab exists under /admin and /dashboard
 * (Home is /admin/dashboard and /dashboard). 'team' refreshes the layout, so
 * open player profiles update too.
 */
export function revalidateTabs(...tabs: Tab[]) {
  for (const tab of tabs) {
    for (const area of ['/admin', '/dashboard']) {
      if (tab === 'home') revalidatePath(area === '/admin' ? '/admin/dashboard' : '/dashboard')
      else if (tab === 'team') revalidatePath(`${area}/team`, 'layout')
      else revalidatePath(`${area}/${tab}`)
    }
  }
}
