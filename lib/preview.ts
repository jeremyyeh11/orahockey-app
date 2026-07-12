import { cookies } from 'next/headers'

// Admin control panel cookies (set client-side in AdminControlPanel)
export const PREVIEW_DATE_COOKIE = 'ora-preview-date'
export const VIEW_COOKIE = 'ora-view'

/**
 * The app's notion of "now". Normally the real clock, but when an admin
 * picks a preview date in the control panel (double-tap ADMIN), this
 * returns noon SGT on that date so every page renders as of that day.
 */
export function getNow(): Date {
  const v = cookies().get(PREVIEW_DATE_COOKIE)?.value
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T12:00:00+08:00`)
  }
  return new Date()
}
