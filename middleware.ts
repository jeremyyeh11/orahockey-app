import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { USER_EMAIL_HEADER, USER_ID_HEADER } from '@/lib/supabase/request-user'

// Role lookups hit the DB, so cache the result in a short-lived cookie.
// Value is `${userId}:${role}` so a different login never reuses it.
const ROLE_COOKIE = 'ora-role'
const ROLE_COOKIE_MAX_AGE = 600 // seconds

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components to see updated auth state.
  // getClaims() verifies the JWT locally against the project's ES256 signing key
  // (JWKS cached across requests), skipping getUser()'s Auth server round-trip.
  // Trade-off: a session revoked elsewhere stays valid until its JWT expires (≤1h).
  // Server actions still call getUser(), so mutations re-check with the Auth server.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (!claims?.sub) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const user = { id: claims.sub, email: claims.email }

  // Forward the verified user so pages skip a second getUser() round-trip.
  // set() overwrites any value the client sent, so these can't be spoofed.
  request.headers.set(USER_ID_HEADER, user.id)
  request.headers.set(USER_EMAIL_HEADER, encodeURIComponent(user.email ?? ''))
  const forwarded = NextResponse.next({ request })
  supabaseResponse.cookies.getAll().forEach((cookie) => forwarded.cookies.set(cookie))
  supabaseResponse = forwarded

  // Role: cookie cache first, DB only on a miss
  let role: string | undefined
  let refreshRoleCookie = false

  const cached = request.cookies.get(ROLE_COOKIE)?.value
  if (cached && cached.startsWith(`${user.id}:`)) {
    role = cached.slice(user.id.length + 1)
  }

  if (!role) {
    let { data: player } = await supabase
      .from('players')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    // First login: auto-link player record by matching email
    if (!player) {
      await supabase.rpc('link_player_account')
      const { data: linked } = await supabase
        .from('players')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()
      player = linked
    }

    role = player?.role ?? 'player'
    refreshRoleCookie = true
  }

  const withRoleCookie = (res: NextResponse) => {
    if (refreshRoleCookie) {
      res.cookies.set(ROLE_COOKIE, `${user.id}:${role}`, {
        path: '/',
        maxAge: ROLE_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
      })
    }
    return res
  }

  // Admins can opt into the player view from the admin control panel
  const viewAsPlayer = request.cookies.get('ora-view')?.value === 'player'

  // Admin trying to access player dashboard → redirect to admin
  if (role === 'admin' && pathname.startsWith('/dashboard') && !viewAsPlayer) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/dashboard'
    return withRoleCookie(NextResponse.redirect(url))
  }

  // Player trying to access admin area → redirect to player dashboard
  if (role !== 'admin' && pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return withRoleCookie(NextResponse.redirect(url))
  }

  return withRoleCookie(supabaseResponse)
}

// Auth + role routing only matter on the app areas; running middleware on
// every route added two network round-trips to each request and prefetch.
export const config = {
  matcher: ['/dashboard/:path*', '/dashboard', '/admin/:path*', '/admin'],
}
