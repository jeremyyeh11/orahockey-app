import type { Metadata } from 'next'
import { HomeView } from '@/components/HomeView'

export const metadata: Metadata = { title: 'Home' }

export default function PlayerHomePage() {
  return <HomeView basePath="/dashboard" />
}
