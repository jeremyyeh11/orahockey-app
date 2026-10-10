import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getRequestUser } from '@/lib/supabase/request-user'
import { getSeasonSquad, getSelectedSeason, inSeason } from '@/lib/season-server'
import SquadClient, { type SquadPlayer, type WhitelistRow } from '@/components/SquadClient'
import type { OutsidePlayer } from '@/app/admin/team/ExistingPlayerPicker'
import type { MatchCardRow } from '@/lib/stats'

/**
 * Shared loader + render for the Squad tab. Used by both the admin and player
 * `team` routes; `basePath` '/admin' also loads the account fields, invites and
 * the players outside this season's squad (all admin-only data).
 */
export async function SquadView({ basePath }: { basePath: '/dashboard' | '/admin' }) {
  const isAdmin = basePath === '/admin'
  const supabase = createClient()

  const [user, season] = await Promise.all([getRequestUser(), getSelectedSeason()])

  const [
    { data: me },
    players,
    { data: stats },
    { data: games },
    { data: potm },
    { data: att },
    { data: cards },
    { data: whitelist },
    { data: everyone },
  ] = await Promise.all([
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
    getSeasonSquad<SquadPlayer>(season.id, isAdmin ? 'email, role, auth_user_id' : '').catch((e: Error) => e),
    fetchAll(() => supabase.from('player_stats').select('player_id, game_id, goals_fg, goals_pc, goals_ps, goals_untyped, assists').order('id')),
    inSeason(supabase.from('games').select('id, game_date, result, goals_against, season_id, game_type'), season).order('game_date', { ascending: false }),
    fetchAll(() => supabase.from('potm').select('game_id, player_id, place').order('id')),
    fetchAll(() => supabase.from('attendance').select('player_id, session_id').eq('session_type', 'game').eq('status', 'attending').order('id')),
    supabase.from('match_cards').select('player_id, game_id, card_type, created_at'),
    isAdmin ? supabase.from('player_whitelist').select('email, invited_at, claimed_at') : Promise.resolve({ data: [] as WhitelistRow[] }),
    // For "+ Existing Player": everyone on the books, minus this season's squad below
    isAdmin
      ? supabase.from('players').select('id, full_name, preferred_name, jersey_number, is_active, email').order('full_name', { ascending: true })
      : Promise.resolve({ data: [] as OutsidePlayer[] }),
  ])

  if (players instanceof Error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">{players.message}</p>
      </div>
    )
  }

  return (
    <SquadClient
      basePath={basePath}
      season={season}
      players={players}
      games={games ?? []}
      stats={stats ?? []}
      potm={potm ?? []}
      attendance={att ?? []}
      cards={(cards ?? []) as MatchCardRow[]}
      myPlayerId={me?.id ?? null}
      whitelist={whitelist ?? []}
      notInSquad={(everyone ?? []).filter((p) => !players.some((m) => m.id === p.id))}
    />
  )
}
