import type { Metadata } from 'next'
import { MyProfileView } from '@/components/MyProfileView'

export const metadata: Metadata = { title: 'Profile' }

export default function PlayerProfileTabPage() {
  return <MyProfileView />
}
