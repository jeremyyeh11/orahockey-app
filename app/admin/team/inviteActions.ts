'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// Where invite links point. The app builds these links itself (they are
// hand-delivered via WhatsApp/DM, not emailed), so this must be the real
// deployed origin in production.
function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === 'production'
      ? 'https://orahockey-app.vercel.app'
      : 'http://localhost:3000')
  )
}

export type SetupLink = {
  url: string
  // invite = first-time account setup; reset = password reset for an
  // existing account. Different Supabase link expiries apply.
  kind: 'invite' | 'reset'
  expiresIn: string
}

/**
 * Generate a private, single-use set-password link for a roster player.
 * Admin-only. The link is returned to the UI for the admin to copy and
 * DM to the player — nothing is emailed.
 */
export async function generateSetupLink(playerId: string): Promise<SetupLink> {
  const supabase = createClient()

  // Caller must be a signed-in admin — the service-role client below
  // bypasses RLS, so this check is the actual gate.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: caller } = await supabase
    .from('players')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()
  if (caller?.role !== 'admin') throw new Error('Only admins can send invites')

  const { data: player } = await supabase
    .from('players')
    .select('id, email, auth_user_id')
    .eq('id', playerId)
    .single()
  if (!player) throw new Error('Player not found')

  // Whitelist gate: only roster emails may get accounts. The insert
  // trigger keeps this in sync, but self-heal for pre-trigger rows.
  const { data: wl } = await supabase
    .from('player_whitelist')
    .select('id')
    .eq('email', player.email)
    .maybeSingle()
  if (!wl) {
    const { error } = await supabase
      .from('player_whitelist')
      .insert({ email: player.email })
    if (error) throw new Error(`Could not whitelist email: ${error.message}`)
  }

  const admin = createAdminClient()

  // New player → 'invite' creates the auth user AND returns the link.
  // Existing account (linked, or invited before) → 'recovery' link.
  let kind: SetupLink['kind'] = player.auth_user_id ? 'reset' : 'invite'
  let { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: kind === 'reset' ? 'recovery' : 'invite',
    email: player.email,
  })

  // Auth user already exists but the player row isn't linked yet
  // (e.g. re-generating an unclaimed invite) — fall back to recovery.
  if (linkError && kind === 'invite') {
    kind = 'reset'
    ;({ data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: player.email,
    }))
  }

  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    throw new Error(linkError?.message ?? 'Could not create the link')
  }

  // Build our own confirm URL from the hashed token (PKCE-safe pattern
  // for @supabase/ssr) instead of using Supabase's action_link, so no
  // redirect-allowlist config is needed.
  const otpType = kind === 'reset' ? 'recovery' : 'invite'
  const url =
    `${siteUrl()}/auth/confirm` +
    `?token_hash=${encodeURIComponent(tokenHash)}` +
    `&type=${otpType}` +
    `&next=${encodeURIComponent('/auth/set-password')}`

  await supabase
    .from('player_whitelist')
    .update({ invited_at: new Date().toISOString() })
    .eq('email', player.email)

  revalidatePath('/admin/team')
  revalidatePath(`/admin/team/${playerId}`)

  return {
    url,
    kind,
    // Supabase defaults: invite links 24h, recovery links 1h.
    expiresIn: kind === 'invite' ? '24 hours' : '1 hour',
  }
}
