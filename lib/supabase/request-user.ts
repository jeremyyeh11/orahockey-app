import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Role, Title } from '@/lib/roles'

// Middleware verifies the session with Supabase Auth, then forwards the user
// on these request headers. It always overwrites them, so a client can't spoof them.
export const USER_ID_HEADER = 'x-ora-user-id'
export const USER_EMAIL_HEADER = 'x-ora-user-email'

export type RequestUser = { id: string; email: string | null }

/**
 * The signed-in user for this request. Reads what middleware already verified
 * instead of a second getUser() round-trip (~150ms). Falls back to getUser()
 * on routes the middleware matcher doesn't cover.
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  const h = headers()
  const id = h.get(USER_ID_HEADER)
  if (id) {
    const email = h.get(USER_EMAIL_HEADER)
    return { id, email: email ? decodeURIComponent(email) : null }
  }

  const {
    data: { user },
  } = await createClient().auth.getUser()
  return user ? { id: user.id, email: user.email ?? null } : null
}

export type ViewerRole = { role: Role | null; titles: Title[] }

/** The signed-in player's role and titles, for their tag in the top bar */
export async function getViewerRole(): Promise<ViewerRole> {
  const user = await getRequestUser()
  if (!user) return { role: null, titles: [] }
  const { data } = await createClient().from('players').select('role, titles').eq('auth_user_id', user.id).maybeSingle()
  return { role: (data?.role as Role | undefined) ?? null, titles: (data?.titles as Title[] | undefined) ?? [] }
}
