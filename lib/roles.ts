/**
 * players.role (001, 034). Admins and the superadmin get the admin area;
 * finemasters and the superadmin waive fines and mark them paid. A finemaster
 * is otherwise a player, and the superadmin otherwise an admin.
 */
export type Role = 'player' | 'finemaster' | 'admin' | 'superadmin'

export const ROLE_LABEL: Record<Role, string> = {
  player: 'Player',
  finemaster: 'Finemaster',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

/** Under the role picker */
export const FINEMASTER_HINT = 'Finemaster: a player who can also waive fines and mark them paid.'

/** Matches is_admin() in SQL */
export const isAdminRole = (role: string | null | undefined) => role === 'admin' || role === 'superadmin'

/** Matches can_manage_fines() in SQL */
export const canManageFines = (role: string | null | undefined) => role === 'finemaster' || role === 'superadmin'

/**
 * players.titles (036): committee jobs. Labels only — permissions stay on the
 * role (most titled players are admins; Equipment is a player). A player can
 * hold several.
 */
export type Title = 'coaching' | 'fitness' | 'welfare' | 'equipment' | 'training'

export const TITLES: Title[] = ['coaching', 'fitness', 'welfare', 'equipment', 'training']

export const TITLE_LABEL: Record<Title, string> = {
  coaching: 'Coaching',
  fitness: 'Fitness',
  welfare: 'Welfare',
  equipment: 'Equipment',
  training: 'Training',
}

/**
 * The plain tags after a name and in the top bar: their titles, Finemaster
 * for a finemaster, and Admin for an admin with no title. The superadmin's
 * shimmering chip is drawn separately (RoleTag).
 */
export function roleLabels(role: Role | null | undefined, titles: readonly Title[] = []): string[] {
  const labels = titles.map((t) => TITLE_LABEL[t])
  if (role === 'finemaster') labels.push(ROLE_LABEL.finemaster)
  if (role === 'admin' && labels.length === 0) labels.push(ROLE_LABEL.admin)
  return labels
}

/** Debug mode (double-tap ADMIN: player view, preview date) */
export const isDebugRole = (role: string | null | undefined) => role === 'superadmin'

/**
 * Roles an admin can pick in the squad editor. Only a superadmin gives or
 * removes superadmin (a DB trigger enforces it), so it's listed for them, or
 * when the player already has it.
 */
export function assignableRoles(viewerIsSuperadmin: boolean, current?: Role): Role[] {
  const roles: Role[] = ['player', 'finemaster', 'admin']
  return viewerIsSuperadmin || current === 'superadmin' ? [...roles, 'superadmin'] : roles
}
