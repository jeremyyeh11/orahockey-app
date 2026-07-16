'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CLUB_NAME, LEAGUE } from '@/lib/constants'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    // ── Local dev shortcut ──────────────────────────────────────────────
    // Typing admin / admin maps to real credentials kept in .env.local
    // (gitignored). Hard-gated to development, so this whole block is
    // dead-code-eliminated from production builds. Never commit .env.local.
    let loginEmail = email
    let loginPassword = password
    if (
      process.env.NODE_ENV === 'development' &&
      email === 'admin' &&
      password === 'admin' &&
      process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL
    ) {
      loginEmail = process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL
      loginPassword = process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD ?? ''
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Fetch role and redirect appropriately
      const { data: player } = await supabase
        .from('players')
        .select('role')
        .eq('auth_user_id', data.user.id)
        .single()

      if (player?.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    }

    setLoading(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-9 text-center">
          <img src="/crest-white.png" alt={CLUB_NAME} className="mx-auto mb-5 h-20 w-20 object-contain" />
          <h1 className="font-display text-[1.7rem] font-bold tracking-tight text-white">
            ORA <span className="text-gold">Hockey</span>
          </h1>
          <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
            {LEAGUE} Team Portal
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate={process.env.NODE_ENV === 'development'}
          className="card space-y-4 p-6"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-gold/60 focus:outline-none focus:ring-1 focus:ring-gold/60"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-gold/60 focus:outline-none focus:ring-1 focus:ring-gold/60"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-gold mt-1 w-full rounded-xl py-3 font-display text-sm font-semibold tracking-wide text-black shadow-[0_2px_10px_-2px_rgba(0,0,0,0.6)] transition hover:brightness-[1.08] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
