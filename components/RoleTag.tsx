import { ROLE_LABEL, type Role } from '@/lib/roles'

const PLAIN: Partial<Record<Role, string>> = {
  admin: 'text-brand-light',
  finemaster: 'text-red-400',
}

/**
 * The role next to a player's name: green Admin, red Finemaster, and the
 * superadmin as a shimmering purple chip (`.liga-role-super` in globals.css).
 * Players get nothing. `onAccent` (your own green squad card) makes the plain
 * tags white so they don't vanish into the green.
 */
export function RoleTag({ role, onAccent = false, className = '' }: { role?: Role | null; onAccent?: boolean; className?: string }) {
  if (!role || role === 'player') return null
  if (role === 'superadmin') {
    return (
      <span className={`liga-role-tag liga-role-super ${className}`}>
        <span className="relative">{ROLE_LABEL.superadmin}</span>
      </span>
    )
  }
  return (
    <span className={`liga-role-tag inline-block text-[10px] font-bold uppercase tracking-wider ${onAccent ? 'text-white' : PLAIN[role]} ${className}`}>
      {ROLE_LABEL[role]}
    </span>
  )
}
