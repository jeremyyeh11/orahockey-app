'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'
import { LogoutIcon } from './icons'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="glass flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-300 transition hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300"
    >
      <LogoutIcon className="h-5 w-5" />
      Sign out
    </button>
  )
}
