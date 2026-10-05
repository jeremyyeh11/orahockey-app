import { PlayerProfileView, playerProfileMetadata } from '@/components/PlayerProfileView'

export function generateMetadata({ params }: { params: { playerId: string } }) {
  return playerProfileMetadata(params.playerId)
}

export default async function AdminPlayerProfileRoute({
  params,
}: {
  params: { playerId: string }
}) {
  return <PlayerProfileView playerId={params.playerId} includeContact includeAccount />
}
