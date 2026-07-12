'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type StatRow = {
  player_id: string
  goals_fg: number
  goals_pc: number
  goals_ps: number
  assists: number
  clean_sheet: boolean
}

function isEmpty(r: StatRow) {
  return r.goals_fg === 0 && r.goals_pc === 0 && r.goals_ps === 0 && r.assists === 0 && !r.clean_sheet
}

export async function saveGameStats(gameId: string, rows: StatRow[]) {
  const supabase = createClient()

  const nonEmpty = rows.filter((r) => !isEmpty(r))
  const empty = rows.filter(isEmpty)

  if (nonEmpty.length > 0) {
    const { error } = await supabase
      .from('player_stats')
      .upsert(
        nonEmpty.map((r) => ({ ...r, game_id: gameId })),
        { onConflict: 'player_id,game_id' }
      )
    if (error) throw new Error(error.message)
  }

  if (empty.length > 0) {
    const { error } = await supabase
      .from('player_stats')
      .delete()
      .eq('game_id', gameId)
      .in(
        'player_id',
        empty.map((r) => r.player_id)
      )
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/stats')
  revalidatePath('/dashboard/stats')
  revalidatePath('/dashboard')
}
