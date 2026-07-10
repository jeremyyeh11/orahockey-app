'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogoutIcon } from './icons'

export default function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={signOut}
      className="glass flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-300 transition hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300"
    >
      <LogoutIcon className="h-5 w-5" />
      Sign out
    </button>
  )
}
