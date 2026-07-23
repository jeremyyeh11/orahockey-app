'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Where invite / reset links land after the token is verified.
// The player picks their password here, then drops into the app —
// middleware links their roster profile and routes them by role.
export default function SetPasswordPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user)
      setChecking(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Middleware links the roster profile and routes by role.
    router.replace('/dashboard')
  }

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition focus:border-[#E0C070]/60 focus:outline-none focus:ring-1 focus:ring-[#E0C070]/60'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-9 text-center">
          <img src="/crest-white.png" alt="ORA Hockey" className="mx-auto mb-5 h-20 w-20 object-contain" />
          <h1 className="font-display text-[1.7rem] font-bold tracking-tight text-white">
            ORA <span className="text-[#E0C070]">Hockey</span>
          </h1>
          <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
            MHL1 Team Portal
          </p>
        </div>

        {checking ? (
          <div className="card p-6 text-center text-sm text-slate-400">Checking your link…</div>
        ) : !hasSession ? (
          <div className="card space-y-3 p-6 text-center">
            <p className="text-sm font-semibold text-white">This link has expired or was already used.</p>
            <p className="text-sm text-slate-400">
              Ask your coach or manager to send you a fresh one — it only takes them a tap.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4 p-6">
            <div>
              <h2 className="text-base font-semibold text-white">Set your password</h2>
              <p className="mt-1 text-sm text-slate-400">
                Choose the password you&apos;ll use to sign in to the team app.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-300">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
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
              disabled={saving}
              className="mt-1 w-full rounded-xl bg-[linear-gradient(180deg,#E0C070_0%,#C0A050_100%)] py-3 font-display text-sm font-semibold tracking-wide text-black shadow-[0_2px_10px_-2px_rgba(0,0,0,0.6)] transition hover:brightness-[1.08] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & sign in'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
