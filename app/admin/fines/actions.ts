'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FineKind, FineReason } from '@/lib/fines'

type FineRef = { playerId: string; kind: FineKind; itemId: string; reason: FineReason }

const keyOf = (fine: FineRef) => ({ player_id: fine.playerId, item_type: fine.kind, item_id: fine.itemId, reason: fine.reason })

function revalidateFines() {
  for (const path of ['/admin/fines', '/dashboard/fines', '/admin/schedule', '/dashboard/schedule']) revalidatePath(path)
}

async function myPlayerId() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data: me } = await supabase.from('players').select('id').eq('auth_user_id', user.id).single()
  return me?.id ?? null
}

/**
 * Waive one fine with a reason (e.g. "PM'd Ish before the change"), or undo
 * that. Admins only — fine_waivers' RLS rejects anyone else.
 */
export async function setFineWaived(fine: FineRef, waived: boolean, note?: string) {
  const supabase = createClient()
  const match = keyOf(fine)
  if (waived) {
    const reason = note?.trim()
    if (!reason) throw new Error('Give a reason for waiving this fine.')
    const { error } = await supabase
      .from('fine_waivers')
      .upsert({ ...match, note: reason, waived_by: await myPlayerId() }, { onConflict: 'player_id,item_type,item_id,reason' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('fine_waivers').delete().match(match)
    if (error) throw new Error(error.message)
  }
  revalidateFines()
}

/** Mark one fine paid, or undo that. Admins only (fine_payments' RLS). */
export async function setFinePaid(fine: FineRef, paid: boolean) {
  const supabase = createClient()
  const match = keyOf(fine)
  if (paid) {
    const { error } = await supabase
      .from('fine_payments')
      .upsert({ ...match, marked_by: await myPlayerId() }, { onConflict: 'player_id,item_type,item_id,reason' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('fine_payments').delete().match(match)
    if (error) throw new Error(error.message)
  }
  revalidateFines()
}
