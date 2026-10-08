import type { Metadata } from 'next'
import { FinesView } from '@/components/FinesView'

export const metadata: Metadata = { title: 'Fines' }

export default function AdminFinesPage({ searchParams }: { searchParams: { month?: string | string[] } }) {
  return <FinesView basePath="/admin" month={typeof searchParams.month === 'string' ? searchParams.month : undefined} />
}
