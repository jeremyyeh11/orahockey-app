// Login-account state for the admin roster dots and profile Account panel.
// Plain module (no 'use client') so server components can call it too.

export type AccountStatus = 'pending' | 'none' | 'invited' | 'active'

/** Account state from a player's email / auth link and their whitelist row */
export function accountStatusOf(
  p: { email: string | null; auth_user_id: string | null },
  invitedAt: string | null | undefined
): AccountStatus {
  if (p.auth_user_id) return 'active'
  if (!p.email) return 'pending'
  return invitedAt ? 'invited' : 'none'
}
