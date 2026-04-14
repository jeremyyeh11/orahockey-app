import { createBrowserClient } from '@supabase/ssr'

const SESSION_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return document.cookie.split(';').flatMap((cookie) => {
            const trimmed = cookie.trim()
            const eqIdx = trimmed.indexOf('=')
            if (eqIdx === -1) return []
            return [{ name: trimmed.slice(0, eqIdx), value: trimmed.slice(eqIdx + 1) }]
          })
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const maxAge = options?.maxAge ?? SESSION_MAX_AGE
            document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
          })
        },
      },
    }
  )
}
