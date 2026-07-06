'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
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
        <div className="mb-8 text-center">
          <div className="bg-gold mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl font-display text-2xl font-black tracking-tight text-[#0a0a0c] shadow-[0_8px_28px_-6px_rgba(203,161,53,0.6)] ring-1 ring-white/20">
            ORA
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            ORA <span className="text-gold">Hockey</span>
          </h1>
          <p className="mt-1 text-sm tracking-wide text-slate-400">MHL1 Team Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-strong space-y-4 rounded-3xl p-6">
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
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/60"
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
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/60"
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
            className="bg-gold w-full rounded-xl py-3 font-display font-semibold text-[#0a0a0c] shadow-[0_6px_20px_-6px_rgba(203,161,53,0.6)] ring-1 ring-white/20 transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
