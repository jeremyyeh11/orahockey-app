import { PlayerProfileView } from '@/components/PlayerProfileView'

export default async function AdminPlayerProfileRoute({
  params,
}: {
  params: { playerId: string }
}) {
  return <PlayerProfileView playerId={params.playerId} includeContact includeAccount />
}
