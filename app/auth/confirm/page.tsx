'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Landing page for invite / password-reset links.
 *
 * IMPORTANT: the one-time token must only be verified on an explicit tap.
 * Messengers (WhatsApp) and mail scanners fetch shared URLs to build link
 * previews — a GET route that verified immediately let those bots consume
 * the token before the player ever opened it. Bots don't tap buttons.
 */
export default function ConfirmPage() {
  const router = useRouter()
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [otpType, setOtpType] = useState<EmailOtpType | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'verifying' | 'invalid'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const th = params.get('token_hash')
    const ty = params.get('type') as EmailOtpType | null
    if (th && ty) {
      setTokenHash(th)
      setOtpType(ty)
      setStatus('ready')
    } else {
      setStatus('invalid')
    }
  }, [])

  async function handleContinue() {
    if (!tokenHash || !otpType) return
    setStatus('verifying')
    setError(null)

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    })

    if (verifyError) {
      setStatus('ready')
      setError(
        'This link has expired or was already used. Ask your coach or manager for a fresh one.'
      )
      return
    }

    router.replace('/auth/set-password')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-9 text-center">
          <img src="/crest-white.png" alt="ORA Hockey" className="mx-auto mb-5 h-20 w-20 object-contain" />
          <h1 className="font-display text-[1.7rem] font-bold tracking-tight text-white">
            ORA <span className="text-gold">Hockey</span>
          </h1>
          <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
            MHL1 Team Portal
          </p>
        </div>

        {status === 'loading' ? (
          <div className="card p-6 text-center text-sm text-slate-400">Loading…</div>
        ) : status === 'invalid' ? (
          <div className="card space-y-3 p-6 text-center">
            <p className="text-sm font-semibold text-white">This link looks incomplete.</p>
            <p className="text-sm text-slate-400">
              Ask your coach or manager to send you a fresh one.
            </p>
          </div>
        ) : (
          <div className="card space-y-4 p-6">
            <div className="text-center">
              <h2 className="text-base font-semibold text-white">
                {otpType === 'recovery' ? 'Reset your password' : 'Welcome to the team app'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Tap continue to {otpType === 'recovery' ? 'choose a new password' : 'set up your account'}.
              </p>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={handleContinue}
              disabled={status === 'verifying'}
              className="bg-gold w-full rounded-xl py-3 font-display text-sm font-semibold tracking-wide text-black shadow-[0_2px_10px_-2px_rgba(0,0,0,0.6)] transition hover:brightness-[1.08] disabled:opacity-50"
            >
              {status === 'verifying' ? 'One moment…' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
