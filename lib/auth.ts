import { createClient } from '@/lib/supabase/client'

/**
 * Sign the current user out. Uses the shared browser client so the same
 * custom cookie handling that created the session also clears it.
 * Redirect at the call site afterwards.
 */
export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
