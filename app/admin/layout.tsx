import AdminShell from './AdminShell'
import { getSeasonNav } from '@/lib/season-server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell seasonNav={await getSeasonNav()}>{children}</AdminShell>
}
