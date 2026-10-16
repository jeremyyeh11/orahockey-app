/**
 * players.role (001, 034, 037): player, admin or superadmin. Admins and the
 * superadmin get the admin area; the superadmin is otherwise an admin who also
 * manages fines, uses debug mode and is the only one who assigns roles and
 * titles (a DB trigger enforces it).
 */
export type Role = 'player' | 'admin' | 'superadmin'

export const ROLES: Role[] = ['player', 'admin', 'superadmin']

export const ROLE_LABEL: Record<Role, string> = {
  player: 'Player',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

/** Matches is_admin() in SQL */
export const isAdminRole = (role: string | null | undefined) => role === 'admin' || role === 'superadmin'

/**
 * players.titles (036, 037): committee jobs, several allowed. Finemaster lets
 * them waive fines and mark them paid; the rest are labels only, since
 * permissions otherwise come from the role (most titled players are admins;
 * Equipment and Finemaster are usually players).
 */
export type Title = 'coaching' | 'fitness' | 'welfare' | 'equipment' | 'training' | 'finemaster'

export const TITLES: Title[] = ['coaching', 'fitness', 'welfare', 'equipment', 'training', 'finemaster']

export const TITLE_LABEL: Record<Title, string> = {
  coaching: 'Coaching',
  fitness: 'Fitness',
  welfare: 'Welfare',
  equipment: 'Equipment',
  training: 'Training',
  finemaster: 'Finemaster',
}

/** Matches can_manage_fines() in SQL: the superadmin, or the Finemaster title */
export const canManageFines = (role: string | null | undefined, titles: readonly string[] | null | undefined) =>
  role === 'superadmin' || !!titles?.includes('finemaster')

/**
 * The plain tags after a name and in the top bar: their titles, or Admin for
 * an admin with none. The superadmin's shimmering chip is drawn separately
 * (RoleTag).
 */
export function roleLabels(role: Role | null | undefined, titles: readonly Title[] = []): string[] {
  const labels = titles.map((t) => TITLE_LABEL[t])
  if (role === 'admin' && labels.length === 0) labels.push(ROLE_LABEL.admin)
  return labels
}

/** Under the role picker, for admins who aren't the superadmin */
export const ROLE_HINT = 'Only the superadmin can change roles and titles.'

/** Under the title picker */
export const TITLE_HINT = 'Shown as tags after their name. Finemaster can waive fines and mark them paid; the others are labels only.'

/** Debug mode (double-tap your top-bar tag: player view, preview date) */
export const isDebugRole = (role: string | null | undefined) => role === 'superadmin'
