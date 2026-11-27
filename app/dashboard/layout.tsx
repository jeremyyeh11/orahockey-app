import DashboardShell from './DashboardShell'
import { getSeasonNav } from '@/lib/season-server'
import { getViewerRole } from '@/lib/supabase/request-user'
import { getOnboarding } from '@/lib/onboarding-server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [seasonNav, viewer, onboarding] = await Promise.all([getSeasonNav(), getViewerRole(), getOnboarding()])
  return (
    <DashboardShell seasonNav={seasonNav} viewer={viewer} onboarding={onboarding}>
      {children}
    </DashboardShell>
  )
}
