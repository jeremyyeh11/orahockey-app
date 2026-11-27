'use server'

import { createClient } from '@/lib/supabase/server'
import { action, requireFineManager, requirePlayerId, revalidateTabs } from '@/lib/action-helpers'
import { getNow } from '@/lib/preview'
import { finedAtFromDate, type FineItemKind, type FineReason } from '@/lib/fines'

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
 * Add a fine by hand: a player, a reason, an amount in cents (220 = $2.20) and the
 * date it was incurred ('YYYY-MM-DD', Singapore; today or earlier). Finemasters and
 * the superadmin only.
 */
export const addFine = action(async (input: { playerId: string; reason: string; amountCents: number; date: string }) => {
  const supabase = createClient()
  await requireFineManager(supabase)
  const reason = input.reason.trim()
  if (!input.playerId) throw new Error('Pick a player.')
  if (!reason) throw new Error('Give a reason for the fine.')
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > 100000) {
    throw new Error('Enter an amount between $0.01 and $1000.')
  }
  const finedAt = finedAtFromDate(input.date, getNow())
  const { error } = await supabase.from('manual_fines').insert({
    player_id: input.playerId,
    reason,
    amount_cents: input.amountCents,
    ...(finedAt ? { fined_at: finedAt } : {}),
    created_by: await requirePlayerId(supabase),
  })
  if (error) throw new Error(error.message)
  revalidateTabs('fines')
})

/**
 * Delete a fine charged by mistake — unlike waiving, it's gone from the list for
 * everyone. A fine added by hand is deleted outright; a derived one is recorded
 * in fine_deletions (044) so it isn't recomputed. Its waiver / payment goes too.
 * Finemasters and the superadmin only.
 */
export const deleteFine = action(async (fine: FineRef) => {
  const supabase = createClient()
  await requireFineManager(supabase)
  const match = keyOf(fine)
  if (fine.kind === 'manual') {
    const { error } = await supabase.from('manual_fines').delete().eq('id', fine.itemId).eq('player_id', fine.playerId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('fine_deletions')
      .upsert({ ...match, deleted_by: await requirePlayerId(supabase) }, { onConflict: 'player_id,item_type,item_id,reason' })
    if (error) throw new Error(error.message)
  }
  for (const table of ['fine_waivers', 'fine_payments'] as const) {
    const { error } = await supabase.from(table).delete().match(match)
    if (error) throw new Error(error.message)
  }
  revalidateTabs('fines', 'schedule')
})
