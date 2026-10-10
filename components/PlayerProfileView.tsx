import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { PlayerProfileOverlay, PlayerProfilePage, type ProfilePlayer, type SquadStatus } from '@/components/PlayerProfilePage'
import { computeSeason, firstSeasonPlayed, yearsAtClub, type PlayerLite, type MatchCardRow, type LeaderboardRow } from '@/lib/stats'
import type { RosterPlayer } from '@/components/RosterList'
import { accountStatusOf, type AccountStatus } from '@/lib/account'
import { getSeasons, getSelectedSeason, hasSeasonRecord } from '@/lib/season-server'
import { getRequestUser } from '@/lib/supabase/request-user'
import type { EditContext } from '@/app/admin/team/PlayerEditModal'
import { recordedStats, seasonTitle } from '@/lib/season'

const BASE_FIELDS = 'id, full_name, preferred_name, jersey_number, position, is_active, date_of_birth, photo_path'
// Admin view additionally exposes contact/role fields (+ auth link for account status).
const ADMIN_FIELDS = `${BASE_FIELDS}, email, role, auth_user_id`

/** Tab title for a profile route — the player's name, e.g. "Akash Prebhash Chandra · ORA Hockey". */
export async function playerProfileMetadata(playerId: string): Promise<Metadata> {
  const { data } = await createClient().from('players').select('full_name').eq('id', playerId).maybeSingle()
  // Names are stored in capitals; title case reads better in a browser tab
  const name = data?.full_name?.toLowerCase().replace(/(^|[\s-])[a-z]/g, (c: string) => c.toUpperCase())
  return { title: name ?? 'Player' }
}

/**
 * Shared loader + render for the player profile route. Used by both the admin
 * and player `[playerId]` routes — they differ only in whether the contact
 * (email/role) fields are selected, controlled by `includeContact`, and
 * whether the account/invite and squad panels show, controlled by
 * `includeAccount` (admin route only — it reads the admin-only
 * player_whitelist table, and squad changes are admin-only).
 */
export async function PlayerProfileView({
  playerId,
  includeContact = false,
  includeAccount = false,
  overlay = false,
}: {
  playerId: string
  includeContact?: boolean
  includeAccount?: boolean
  /** Opened over the Squad list via the intercepted route (dialog on desktop) */
  overlay?: boolean
}) {
  const supabase = createClient()
  const [season, user, seasons] = await Promise.all([getSelectedSeason(), includeAccount ? getRequestUser() : null, getSeasons()])

  const [
    { data: player, error: playerErr },
    { data: seasonEntry },
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
    // Jersey number for the season being viewed (positions are per player).
    // "All time" isn't a season: they keep their latest number from players.
    season.allTime
      ? Promise.resolve({ data: null })
      : supabase
          .from('season_players')
          .select('jersey_number')
          .eq('season_id', season.id)
          .eq('player_id', playerId)
          .maybeSingle(),
    supabase.from('games').select('id, game_date, result, goals_against, season_id, game_type').order('game_date', { ascending: false }),
    fetchAll(() => supabase.from('player_stats').select('player_id, game_id, goals_fg, goals_pc, goals_ps, goals_untyped, assists').order('id')),
    fetchAll(() => supabase.from('potm').select('game_id, player_id, place').order('id')),
    fetchAll(() => supabase.from('attendance').select('player_id, session_id').eq('session_type', 'game').eq('status', 'attending').order('id')),
    supabase.from('match_cards').select('player_id, game_id, card_type, created_at'),
  ])

  if (playerErr || !player) {
    return <div className="liga-page liga-error-state p-4 text-sm text-red-400">Player not found.</div>
  }

  // Not in this season's squad → keep their latest jersey number from players
  const profile = { ...(player as unknown as ProfilePlayer), ...(seasonEntry ?? {}) } as ProfilePlayer

  // Account status for the admin invite panel
  let accountStatus: AccountStatus | undefined
  if (includeAccount) {
    const p = player as unknown as { email: string | null; auth_user_id: string | null }
    // Pending players (no email yet) have no whitelist row to look up
    const { data: wl } = p.email
      ? await supabase.from('player_whitelist').select('invited_at').eq('email', p.email).maybeSingle()
      : { data: null }
    accountStatus = accountStatusOf(p, wl?.invited_at)
  }

  // Admin view: what the Edit form may change (the jersey number is per season)
  let editContext: EditContext | undefined
  if (includeAccount) {
    const p = player as unknown as { auth_user_id: string | null }
    editContext = {
      seasonLabel: season.label,
      jerseyMode: seasonEntry ? (season.locked ? 'archived' : 'season') : 'default',
      hasAccount: !!p.auth_user_id,
      isSelf: !!p.auth_user_id && p.auth_user_id === user?.id,
    }
  }

  // Squad membership controls for the selected season — admin view, open seasons only
  let squadStatus: SquadStatus | undefined
  if (includeAccount && !season.locked) {
    squadStatus = {
      seasonLabel: season.label,
      inSquad: !!seasonEntry,
      hasRecord: seasonEntry ? await hasSeasonRecord(season.id, playerId) : false,
      isActive: profile.is_active,
    }
  }
  const players: (PlayerLite & RosterPlayer)[] = [profile as unknown as PlayerLite & RosterPlayer]
  const cards = (cardRows ?? []) as MatchCardRow[]

  let seasonRow: LeaderboardRow | undefined
  let careerRow: LeaderboardRow | undefined

  try {
    // "All time": the career row is the whole story — no separate season row
    const { leaderboard: seasonLb } = season.allTime ? { leaderboard: [] as LeaderboardRow[] } : computeSeason({
      players,
      games: games ?? [],
      stats: stats ?? [],
      potm: potm ?? [],
      attendance: att ?? [],
      cards,
      season: season.label,
      seasonId: season.id,
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

  const Profile = overlay ? PlayerProfileOverlay : PlayerProfilePage
  return (
    <Profile
      player={profile}
      seasonRow={seasonRow}
      careerRow={careerRow}
      seasonLabel={season.allTime ? null : seasonTitle(season)}
      recorded={season.allTime ? undefined : recordedStats(season)}
      yearsAtClub={yearsAtClub(
        firstSeasonPlayed(profile.id, games ?? [], att ?? [], seasons),
        seasons.find((s) => s.is_current)?.label
      )}
      accountStatus={accountStatus}
      squadStatus={squadStatus}
      editContext={editContext}
    />
  )
}
