'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin, requirePlayerId, revalidateTabs } from '@/lib/action-helpers'
import type { FineKind, FineReason } from '@/lib/fines'

type FineRef = { playerId: string; kind: FineKind; itemId: string; reason: FineReason }

const keyOf = (fine: FineRef) => ({ player_id: fine.playerId, item_type: fine.kind, item_id: fine.itemId, reason: fine.reason })

/**
 * Waive one fine with a reason (e.g. "PM'd Ish before the change"), or undo
 * that. Admins only.
 */
export async function setFineWaived(fine: FineRef, waived: boolean, note?: string) {
  const supabase = createClient()
  await requireAdmin(supabase)
  const match = keyOf(fine)
  if (waived) {
    const reason = note?.trim()
    if (!reason) throw new Error('Give a reason for waiving this fine.')
    const { error } = await supabase
      .from('fine_waivers')
      .upsert({ ...match, note: reason, waived_by: await requirePlayerId(supabase) }, { onConflict: 'player_id,item_type,item_id,reason' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('fine_waivers').delete().match(match)
    if (error) throw new Error(error.message)
  }
  revalidateTabs('fines', 'schedule')
}

/** Mark one fine paid, or undo that. Admins only. */
export async function setFinePaid(fine: FineRef, paid: boolean) {
  const supabase = createClient()
  await requireAdmin(supabase)
  const match = keyOf(fine)
  if (paid) {
    const { error } = await supabase
      .from('fine_payments')
      .upsert({ ...match, marked_by: await requirePlayerId(supabase) }, { onConflict: 'player_id,item_type,item_id,reason' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('fine_payments').delete().match(match)
    if (error) throw new Error(error.message)
  }
  revalidateTabs('fines', 'schedule')
}
