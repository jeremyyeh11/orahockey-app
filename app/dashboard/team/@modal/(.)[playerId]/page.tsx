import { PlayerProfileView } from '@/components/PlayerProfileView'

export default async function PlayerProfileOverlay({
  params,
}: {
  params: { playerId: string }
}) {
  return <PlayerProfileView playerId={params.playerId} overlay />
}
