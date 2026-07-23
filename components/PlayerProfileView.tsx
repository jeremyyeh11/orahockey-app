import { createClient } from '@/lib/supabase/server'
import { PlayerProfilePage, type ProfilePlayer, type AccountStatus } from '@/components/PlayerProfilePage'
import { computeSeason, seasonsOf, type PlayerLite, type MatchCardRow, type LeaderboardRow } from '@/lib/stats'
import type { RosterPlayer } from '@/components/RosterList'
import { getNow } from '@/lib/preview'
import { LEAGUE } from '@/lib/constants'

const BASE_FIELDS = 'id, full_name, preferred_name, jersey_number, position, is_active, date_of_birth, joined_year'
// Admin view additionally exposes contact/role fields (+ auth link for account status).
const ADMIN_FIELDS = `${BASE_FIELDS}, email, role, auth_user_id`

/**
 * Shared loader + render for the player profile route. Used by both the admin
 * and player `[playerId]` routes — they differ only in whether the contact
 * (email/role) fields are selected, controlled by `includeContact`, and
 * whether the account/invite panel shows, controlled by `includeAccount`
 * (admin route only — it reads the admin-only player_whitelist table).
 */
export async function PlayerProfileView({
  playerId,
  includeContact = false,
  includeAccount = false,
}: {
  playerId: string
  includeContact?: boolean
  includeAccount?: boolean
}) {
  const supabase = createClient()

  const [
    { data: player, error: playerErr },
    { data: games },
    { data: stats },
    { data: potm },
    { data: att },
    { data: cardRows },
  ] = await Promise.all([
    supabase
      .from('players')
      .select(includeContact ? ADMIN_FIELDS : BASE_FIELDS)
      .eq('id', playerId)
      .single(),
    supabase.from('games').select('id, game_date, result, goals_against').order('game_date', { ascending: false }),
    supabase.from('player_stats').select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists'),
    supabase.from('potm').select('game_id, player_id, place'),
    supabase.from('attendance').select('player_id, session_id').eq('session_type', 'game').eq('status', 'attending'),
    supabase.from('match_cards').select('player_id, game_id, card_type, created_at'),
  ])

  if (playerErr || !player) {
    return <div className="p-4 text-sm text-red-400">Player not found.</div>
  }

  const profile = player as unknown as ProfilePlayer

  // Account status for the admin invite panel
  let accountStatus: AccountStatus | undefined
  if (includeAccount) {
    const p = player as unknown as { email: string; auth_user_id: string | null }
    const { data: wl } = await supabase
      .from('player_whitelist')
      .select('invited_at')
      .eq('email', p.email)
      .maybeSingle()
    accountStatus = p.auth_user_id ? 'active' : wl?.invited_at ? 'invited' : 'none'
  }
  const players: (PlayerLite & RosterPlayer)[] = [player as unknown as PlayerLite & RosterPlayer]
  const cards = (cardRows ?? []) as MatchCardRow[]
  const seasons = seasonsOf(games ?? [])
  const currentSeason = seasons[0] ?? String(getNow().getFullYear())

  let seasonRow: LeaderboardRow | undefined
  let careerRow: LeaderboardRow | undefined

  try {
    const { leaderboard: seasonLb } = computeSeason({
      players,
      games: games ?? [],
      stats: stats ?? [],
      potm: potm ?? [],
      attendance: att ?? [],
      cards,
      season: currentSeason,
    })
    const { leaderboard: careerLb } = computeSeason({
      players,
      games: games ?? [],
      stats: stats ?? [],
      potm: potm ?? [],
      attendance: att ?? [],
      cards,
      season: 'all',
    })
    seasonRow = seasonLb.find((r) => r.player.id === profile.id)
    careerRow = careerLb.find((r) => r.player.id === profile.id)
  } catch (e) {
    // computeSeason may crash if data is incomplete — that's fine, just show no stats
  }

  return (
    <PlayerProfilePage
      player={profile}
      seasonRow={seasonRow}
      careerRow={careerRow}
      seasonLabel={`${LEAGUE} ${currentSeason}`}
      accountStatus={accountStatus}
    />
  )
}
