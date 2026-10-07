/** Keep the Liga visual system on authenticated application routes only. */
export function isLigaAppPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') ||
    pathname === '/admin' || pathname.startsWith('/admin/')
}
