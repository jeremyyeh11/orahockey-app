'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin, revalidateTabs } from '@/lib/action-helpers'

export type TeamListEntry = {
  player_id: string
  selected: boolean
}

/**
 * Save the team list for a game (draft or publish).
 * Replaces all existing entries for the game with the new set.
 */
export async function saveTeamList(
  gameId: string,
  entries: TeamListEntry[],
  status: 'draft' | 'published'
) {
  const supabase = createClient()
  await requireAdmin(supabase)

  // Delete existing entries
  await supabase.from('match_team_lists').delete().eq('game_id', gameId)

  // Insert new entries (only selected players)
  const rows = entries
    .filter((e) => e.selected)
    .map((e) => ({
      game_id: gameId,
      player_id: e.player_id,
      selected: true,
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from('match_team_lists').insert(rows)
    if (error) throw new Error(error.message)
  }

  // Update game's team_list_status
  const { error: gameErr } = await supabase
    .from('games')
    .update({ team_list_status: status })
    .eq('id', gameId)

  if (gameErr) throw new Error(gameErr.message)

  revalidateTabs('schedule', 'home')
}

/**
 * Unpublish the team list (set status to draft, hide from players)
 */
export async function unpublishTeamList(gameId: string) {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { error } = await supabase
    .from('games')
    .update({ team_list_status: 'draft' })
    .eq('id', gameId)

  if (error) throw new Error(error.message)

  revalidateTabs('schedule', 'home')
}
