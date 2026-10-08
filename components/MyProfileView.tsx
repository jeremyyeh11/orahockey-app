import { createClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/supabase/request-user'
import { getSeasons } from '@/lib/season-server'
import { statsRecorded } from '@/lib/season'
import { computeSeason, yearsAtClub, type LeaderboardRow, type MatchCardRow, type PlayerLite } from '@/lib/stats'
import { playerPhotoUrl } from '@/lib/photos'
import MyProfile, { type MyProfileData } from '@/components/MyProfile'

/**
 * The Profile tab — every player's own page (admins included): identity, details
 * they can edit (preferred name, date of birth, positions), their stats season
 * by season with a career total, and Sign out. League games only, like every
 * other stat (computeSeason drops friendlies).
 */
export async function MyProfileView() {
  const supabase = createClient()
  const user = await getRequestUser()

  const { data: player } = await supabase
    .from('players')
    .select('id, full_name, preferred_name, jersey_number, position, is_active, date_of_birth, photo_path, email, role')
    .eq('auth_user_id', user?.id ?? '')
    .maybeSingle()

  if (!player) {
    return <div className="liga-page liga-error-state p-4 text-sm text-red-400">No player record is linked to this account.</div>
  }

  const [seasons, { data: squads }, { data: games }, { data: stats }, { data: potm }, { data: att }, { data: cardRows }] = await Promise.all([
    getSeasons(),
    supabase.from('season_players').select('season_id, jersey_number').eq('player_id', player.id),
    supabase.from('games').select('id, game_date, result, goals_against, season_id, game_type'),
    supabase.from('player_stats').select('player_id, game_id, goals_fg, goals_pc, goals_ps, assists').eq('player_id', player.id),
    supabase.from('potm').select('game_id, player_id, place').eq('player_id', player.id),
    supabase.from('attendance').select('player_id, session_id').eq('player_id', player.id).eq('session_type', 'game').eq('status', 'attending'),
    supabase.from('match_cards').select('player_id, game_id, card_type, created_at').eq('player_id', player.id),
  ])

  const base = {
    players: [player as unknown as PlayerLite],
    games: games ?? [],
    stats: stats ?? [],
    potm: potm ?? [],
    attendance: att ?? [],
    cards: (cardRows ?? []) as MatchCardRow[],
  }
  const rowOf = (season: string, seasonId?: string): LeaderboardRow | null => {
    try {
      return computeSeason({ ...base, season, seasonId }).leaderboard.find((r) => r.player.id === player.id) ?? null
    } catch {
      return null
    }
  }

  // One row per season they've been in the squad for, newest first
  const inSquad = new Map((squads ?? []).map((s) => [s.season_id, s.jersey_number as number | null]))
  const bySeason = seasons
    .filter((s) => inSquad.has(s.id))
    .map((s) => ({ label: s.label, current: s.is_current, jersey: inSquad.get(s.id) ?? null, statsRecorded: statsRecorded(s), row: rowOf(s.label, s.id) }))
  const current = seasons.find((s) => s.is_current)
  // First season with a league appearance (seasons come newest first)
  const firstSeason = [...bySeason].reverse().find((s) => (s.row?.caps ?? 0) > 0)?.label ?? null

  const data: MyProfileData = {
    player: {
      id: player.id,
      full_name: player.full_name,
      preferred_name: player.preferred_name,
      // This season's number if they're in the squad, else their default
      jersey_number: (current && inSquad.get(current.id)) ?? player.jersey_number,
      position: player.position,
      date_of_birth: player.date_of_birth,
      email: player.email,
      role: player.role,
      photoUrl: playerPhotoUrl(player.photo_path),
    },
    seasons: bySeason,
    career: rowOf('all'),
    firstSeason,
    yearsAtClub: yearsAtClub(firstSeason, current?.label),
  }
  return <MyProfile data={data} />
}
