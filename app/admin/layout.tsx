import AdminShell from './AdminShell'
import { getSeasonNav } from '@/lib/season-server'
import { isDebugMode } from '@/lib/preview'
import { getViewerRole } from '@/lib/supabase/request-user'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [seasonNav, viewer] = await Promise.all([getSeasonNav(), getViewerRole()])
  return (
    <AdminShell seasonNav={seasonNav} viewer={viewer} debug={isDebugMode()}>
      {children}
    </AdminShell>
  )
}
