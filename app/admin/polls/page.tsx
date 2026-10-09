import type { Metadata } from 'next'
import { PollsView } from '@/components/PollsView'

export const metadata: Metadata = { title: 'Polls' }

export default function AdminPollsPage() {
  return <PollsView basePath="/admin" />
}
