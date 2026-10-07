import DashboardShell from './DashboardShell'
import { getSeasonNav } from '@/lib/season-server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell seasonNav={await getSeasonNav()}>{children}</DashboardShell>
}
