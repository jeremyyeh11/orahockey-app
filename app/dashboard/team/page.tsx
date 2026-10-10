import type { Metadata } from 'next'
import { SquadView } from '@/components/SquadView'

export const metadata: Metadata = { title: 'Squad' }

export default function PlayerSquadPage() {
  return <SquadView basePath="/dashboard" />
}
