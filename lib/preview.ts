import { cookies, headers } from 'next/headers'

// Debug mode cookies (set client-side in AdminControlPanel)
export const PREVIEW_DATE_COOKIE = 'ora-preview-date'
export const VIEW_COOKIE = 'ora-view'

// Middleware sets this on the request for superadmins only, and always
// overwrites what the client sent, so it can't be spoofed.
export const DEBUG_HEADER = 'x-ora-debug'

/** Whether the signed-in user may use debug mode (superadmins) */
export function isDebugMode(): boolean {
  return headers().get(DEBUG_HEADER) === '1'
}

/**
 * The app's notion of "now". Normally the real clock, but when a superadmin
 * picks a preview date in debug mode (double-tap ADMIN), this returns noon
 * SGT on that date so every page renders as of that day.
 */
export function getNow(): Date {
  const v = cookies().get(PREVIEW_DATE_COOKIE)?.value
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && isDebugMode()) {
    return new Date(`${v}T12:00:00+08:00`)
  }
  return new Date()
}
