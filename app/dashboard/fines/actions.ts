'use server'

import { createClient } from '@/lib/supabase/server'
import { action, requireFineManager, requirePlayerId, revalidateTabs } from '@/lib/action-helpers'
import type { FineItemKind, FineReason } from '@/lib/fines'

type FineRef = { playerId: string; kind: FineItemKind; itemId: string; reason: FineReason }

const keyOf = (fine: FineRef) => ({ player_id: fine.playerId, item_type: fine.kind, item_id: fine.itemId, reason: fine.reason })

/**
 * Waive one fine with a reason (e.g. "PM'd Ish before the change"), or undo
 * that. Finemasters and the superadmin only.
 */
export const setFineWaived = action(async (fine: FineRef, waived: boolean, note?: string) => {
  const supabase = createClient()
  await requireFineManager(supabase)
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
})

/** Mark one fine paid, or undo that. Finemasters and the superadmin only. */
export const setFinePaid = action(async (fine: FineRef, paid: boolean) => {
  const supabase = createClient()
  await requireFineManager(supabase)
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
})

/**
 * Add a fine by hand: a player, a reason and an amount in cents (220 = $2.20).
 * Finemasters and the superadmin only.
 */
export const addFine = action(async (input: { playerId: string; reason: string; amountCents: number }) => {
  const supabase = createClient()
  await requireFineManager(supabase)
  const reason = input.reason.trim()
  if (!input.playerId) throw new Error('Pick a player.')
  if (!reason) throw new Error('Give a reason for the fine.')
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > 100000) {
    throw new Error('Enter an amount between $0.01 and $1000.')
  }
  const { error } = await supabase.from('manual_fines').insert({
    player_id: input.playerId,
    reason,
    amount_cents: input.amountCents,
    created_by: await requirePlayerId(supabase),
  })
  if (error) throw new Error(error.message)
  revalidateTabs('fines')
})
