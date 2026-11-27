import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'

/**
 * The signed-in player's tour / What's new state (player_onboarding, 045).
 * `isNew`: no row yet, a new account, so the app shows the tour. Null when
 * the account has no player record (nothing to show).
 */
export type OnboardingState = { isNew: boolean; tourDone: boolean; seenRelease: string | null }

export async function getOnboarding(): Promise<OnboardingState | null> {
  const user = await getRequestUser()
  if (!user) return null
  const supabase = createClient()
  const { data: me } = await supabase.from('players').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!me) return null
  const { data, error } = await supabase
    .from('player_onboarding')
    .select('tour_done_at, seen_release')
    .eq('player_id', me.id)
    .maybeSingle()
  // Table missing or unreadable: show nothing rather than a tour on every load
  if (error) return null
  return { isNew: !data, tourDone: !!data?.tour_done_at, seenRelease: data?.seen_release ?? null }
}
