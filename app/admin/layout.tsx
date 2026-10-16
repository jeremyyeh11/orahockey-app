import AdminShell from './AdminShell'
import { getSeasonNav } from '@/lib/season-server'
import { isDebugMode } from '@/lib/preview'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminShell seasonNav={await getSeasonNav()} debug={isDebugMode()}>
      {children}
    </AdminShell>
  )
}
