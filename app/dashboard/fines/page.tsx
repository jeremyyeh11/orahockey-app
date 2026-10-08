import type { Metadata } from 'next'
import { FinesView } from '@/components/FinesView'

export const metadata: Metadata = { title: 'Fines' }

export default function PlayerFinesPage({ searchParams }: { searchParams: { month?: string | string[] } }) {
  return <FinesView basePath="/dashboard" month={typeof searchParams.month === 'string' ? searchParams.month : undefined} />
}
