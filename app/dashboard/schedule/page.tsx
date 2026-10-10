import type { Metadata } from 'next'
import { ScheduleView } from '@/components/ScheduleView'

export const metadata: Metadata = { title: 'Schedule' }

/** `?event=game-<id>` (Home's "Open details") opens that event's details */
export default function PlayerSchedulePage({ searchParams }: { searchParams: { event?: string | string[] } }) {
  return <ScheduleView basePath="/dashboard" event={typeof searchParams.event === 'string' ? searchParams.event : undefined} />
}
