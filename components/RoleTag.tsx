import { ROLE_LABEL, roleLabels, type Role, type Title } from '@/lib/roles'

/**
 * The role next to a player's name, as chips: their titles (Coaching, Fitness,
 * ...), Finemaster, or Admin for an untitled admin, all in a plain grey chip
 * (`.liga-role-chip`), plus the superadmin's shimmering purple chip
 * (`.liga-role-super`). Untitled players get nothing. `onAccent` (your own
 * green squad card) lightens the plain chips so they don't vanish into the green.
 */
export function RoleTag({
  role,
  titles,
  onAccent = false,
  className = '',
}: {
  role?: Role | null
  titles?: readonly Title[] | null
  onAccent?: boolean
  className?: string
}) {
  const labels = roleLabels(role, titles ?? [])
  if (role !== 'superadmin' && labels.length === 0) return null
  return (
    <span className={`liga-role-tags ${className}`}>
      {role === 'superadmin' && (
        <span className="liga-role-tag liga-role-super">
          <span className="relative">{ROLE_LABEL.superadmin}</span>
        </span>
      )}
      {labels.map((label) => (
        <span key={label} className={`liga-role-tag liga-role-chip${onAccent ? ' liga-role-chip-accent' : ''}`}>
          {label}
        </span>
      ))}
    </span>
  )
}
