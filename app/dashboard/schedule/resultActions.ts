'use server'

// Match result entry (backlog #4) — open to ALL signed-in players, not just admins.
// Score goes through the set_match_score definer function (games is admin-write under RLS);
// goal/card rows are written directly (their RLS allows players once the match has been played).
// player_stats stays in sync via the match_goals trigger.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type GoalRow = {
  id: string
  game_id: string
  goal_number: number
  scorer_id: string
  assist_kind: 'player' | 'pc' | 'ps' | null
  assist_player_id: string | null
}

export type CardRow = {
  id: string
  game_id: string
  player_id: string
  card_type: 'green' | 'yellow' | 'red'
}

function revalidate() {
  revalidatePath('/admin/schedule')
  revalidatePath('/dashboard/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/dashboard')
  // Squad pages derive stats/cards from these rows
  revalidatePath('/admin/team')
  revalidatePath('/dashboard/team')
}

export async function setMatchScore(gameId: string, goalsFor: number, goalsAgainst: number) {
  const supabase = createClient()

  const { error } = await supabase.rpc('set_match_score', {
    p_game_id: gameId,
    p_goals_for: goalsFor,
    p_goals_against: goalsAgainst,
  })

  if (error) throw new Error(error.message)
  revalidate()
}

/**
 * Fill (or change) one scorer slot. `assist` is 'pc', 'ps', a player id, or null (unassisted).
 * Returns the saved row so the client can keep ids for re-ordering.
 */
export async function saveGoal(
  gameId: string,
  goalNumber: number,
  scorerId: string,
  assist: string | null
): Promise<GoalRow> {
  const supabase = createClient()

  const assist_kind = assist === 'pc' || assist === 'ps' ? assist : assist ? 'player' : null
  const assist_player_id = assist_kind === 'player' ? assist : null

  const { data, error } = await supabase
    .from('match_goals')
    .upsert(
      {
        game_id: gameId,
        goal_number: goalNumber,
        scorer_id: scorerId,
        assist_kind,
        assist_player_id,
      },
      { onConflict: 'game_id,goal_number' }
    )
    .select('id, game_id, goal_number, scorer_id, assist_kind, assist_player_id')
    .single()

  if (error) throw new Error(error.message)
  revalidate()
  return data as GoalRow
}

export async function deleteGoal(gameId: string, goalNumber: number) {
  const supabase = createClient()

  const { error } = await supabase
    .from('match_goals')
    .delete()
    .eq('game_id', gameId)
    .eq('goal_number', goalNumber)

  if (error) throw new Error(error.message)
  revalidate()
}

/** Persist a drag re-order: parallel arrays of goal row ids and their new goal numbers. */
export async function reorderGoals(gameId: string, goalIds: string[], numbers: number[]) {
  const supabase = createClient()

  const { error } = await supabase.rpc('reorder_match_goals', {
    p_game_id: gameId,
    p_goal_ids: goalIds,
    p_numbers: numbers,
  })

  if (error) throw new Error(error.message)
  revalidate()
}

export async function addCard(
  gameId: string,
  playerId: string,
  cardType: 'green' | 'yellow' | 'red'
): Promise<CardRow> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('match_cards')
    .insert({ game_id: gameId, player_id: playerId, card_type: cardType })
    .select('id, game_id, player_id, card_type')
    .single()

  if (error) throw new Error(error.message)
  revalidate()
  return data as CardRow
}

export async function removeCard(cardId: string) {
  const supabase = createClient()

  const { error } = await supabase.from('match_cards').delete().eq('id', cardId)

  if (error) throw new Error(error.message)
  revalidate()
}
