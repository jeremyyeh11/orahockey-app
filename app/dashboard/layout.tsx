import DashboardShell from './DashboardShell'
import { getSeasonNav } from '@/lib/season-server'
import { getViewerRole } from '@/lib/supabase/request-user'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [seasonNav, viewer] = await Promise.all([getSeasonNav(), getViewerRole()])
  return (
    <DashboardShell seasonNav={seasonNav} viewer={viewer}>
      {children}
    </DashboardShell>
  )
}
