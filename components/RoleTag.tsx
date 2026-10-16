import { ROLE_LABEL, roleTags, type Role, type Title } from '@/lib/roles'

/**
 * The role next to a player's name, as chips: their titles (Coaching, Fitness,
 * ..., Finemaster), each tinted its own colour (`.liga-role-<title>`), or a
 * grey Admin chip for an untitled admin, plus the superadmin's shimmering
 * purple chip (`.liga-role-super`). Untitled players get nothing. `onAccent`
 * (your own green squad card) turns the chips white so they don't clash with the green.
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
  const tags = roleTags(role, titles ?? [])
  if (role !== 'superadmin' && tags.length === 0) return null
  return (
    <span className={`liga-role-tags ${className}`}>
      {role === 'superadmin' && (
        <span className="liga-role-tag liga-role-super">
          <span className="relative">{ROLE_LABEL.superadmin}</span>
        </span>
      )}
      {tags.map(({ key, label }) => (
        <span
          key={key}
          className={`liga-role-tag liga-role-chip${key === 'admin' ? '' : ` liga-role-${key}`}${onAccent ? ' liga-role-chip-accent' : ''}`}
        >
          {label}
        </span>
      ))}
    </span>
  )
}
