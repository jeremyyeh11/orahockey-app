import { PlayerProfileView } from '@/components/PlayerProfileView'

export default async function AdminPlayerProfileOverlay({
  params,
}: {
  params: { playerId: string }
}) {
  return <PlayerProfileView playerId={params.playerId} includeContact includeAccount overlay />
}
