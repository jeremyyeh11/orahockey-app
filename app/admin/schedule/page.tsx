import type { Metadata } from 'next'
import { ScheduleView } from '@/components/ScheduleView'

export const metadata: Metadata = { title: 'Schedule' }

/** `?event=game-<id>` (Home's "Open details") opens that event's details */
export default function AdminSchedulePage({ searchParams }: { searchParams: { event?: string | string[] } }) {
  return <ScheduleView basePath="/admin" event={typeof searchParams.event === 'string' ? searchParams.event : undefined} />
}
