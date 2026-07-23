import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client for auth admin operations (creating users,
// generating invite/recovery links). SERVER ONLY — the service-role
// key bypasses RLS and must never reach the browser, so this module
// must only ever be imported from server actions / route handlers,
// and the key must live in a non-NEXT_PUBLIC env var.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Server is missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local (dev) and Vercel env vars (prod).'
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
