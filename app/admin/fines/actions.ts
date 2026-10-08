'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FineKind, FineReason } from '@/lib/fines'

/**
 * Waive one fine (e.g. they PM'd the coaching committee about a last-minute
 * change), or undo that. Admins only — fine_waivers' RLS rejects anyone else.
 */
export async function setFineWaived(
  fine: { playerId: string; kind: FineKind; itemId: string; reason: FineReason },
  waived: boolean
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const match = { player_id: fine.playerId, item_type: fine.kind, item_id: fine.itemId, reason: fine.reason }
  if (waived) {
    const { data: me } = await supabase.from('players').select('id').eq('auth_user_id', user.id).single()
    const { error } = await supabase
      .from('fine_waivers')
      .upsert({ ...match, waived_by: me?.id ?? null }, { onConflict: 'player_id,item_type,item_id,reason' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('fine_waivers').delete().match(match)
    if (error) throw new Error(error.message)
  }

  for (const path of ['/admin/fines', '/dashboard/fines', '/admin/dashboard', '/dashboard', '/admin/schedule', '/dashboard/schedule']) {
    revalidatePath(path)
  }
}
