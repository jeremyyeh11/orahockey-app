import { PlayerProfileView } from '@/components/PlayerProfileView'

export default async function PlayerProfileRoute({
  params,
}: {
  params: { playerId: string }
}) {
  return <PlayerProfileView playerId={params.playerId} />
}
