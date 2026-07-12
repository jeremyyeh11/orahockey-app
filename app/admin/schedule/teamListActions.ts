'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type TeamListEntry = {
  player_id: string
  selected: boolean
}

export type TeamListStatus = 'draft' | 'published' | null

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: me } = await supabase
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!me || me.role !== 'admin') throw new Error('Admin only')

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

  revalidatePath('/admin/schedule')
  revalidatePath('/dashboard/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/dashboard')
}

/**
 * Unpublish the team list (set status to draft, hide from players)
 */
export async function unpublishTeamList(gameId: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: me } = await supabase
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!me || me.role !== 'admin') throw new Error('Admin only')

  const { error } = await supabase
    .from('games')
    .update({ team_list_status: 'draft' })
    .eq('id', gameId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/schedule')
  revalidatePath('/dashboard/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/dashboard')
}
