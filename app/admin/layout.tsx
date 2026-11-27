import AdminShell from './AdminShell'
import { getSeasonNav } from '@/lib/season-server'
import { isDebugMode } from '@/lib/preview'
import { getViewerRole } from '@/lib/supabase/request-user'
import { getOnboarding } from '@/lib/onboarding-server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [seasonNav, viewer, onboarding] = await Promise.all([getSeasonNav(), getViewerRole(), getOnboarding()])
  return (
    <AdminShell seasonNav={seasonNav} viewer={viewer} debug={isDebugMode()} onboarding={onboarding}>
      {children}
    </AdminShell>
  )
}
