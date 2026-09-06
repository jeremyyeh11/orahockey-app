/** Keep the first visual pilot off Home, Polls, profiles and authentication. */
export function isLigaPilotPath(pathname: string | null): boolean {
  return pathname === '/dashboard/team' || pathname === '/dashboard/schedule' ||
    pathname === '/admin/team' || pathname === '/admin/schedule'
}
