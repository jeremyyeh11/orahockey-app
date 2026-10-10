'use server'

import { createClient } from '@/lib/supabase/server'
import { action, requirePlayerId, revalidateTabs } from '@/lib/action-helpers'
import { OUT_REASON_MAX } from '@/lib/fines'

export const setAttendance = action(async (
  sessionId: string,
  sessionType: 'game' | 'training' | 'event',
  status: 'attending' | 'not_attending' | 'maybe'
) => {
  const supabase = createClient()

  const { error } = await supabase.from('attendance').upsert(
    {
      player_id: await requirePlayerId(supabase),
      session_id: sessionId,
      session_type: sessionType,
      status,
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'player_id,session_id,session_type' }
  )

  if (error) throw new Error(error.message)

  revalidateTabs('schedule', 'home')
})

/** Why I'm out (optional, everyone sees it). Only saved while my answer is Out; blank clears it. */
export const setOutReason = action(async (
  sessionId: string,
  sessionType: 'game' | 'training' | 'event',
  reason: string
) => {
  const supabase = createClient()
  const text = reason.trim()
  if (text.length > OUT_REASON_MAX) throw new Error(`Keep the reason under ${OUT_REASON_MAX} characters`)

  const { error } = await supabase
    .from('attendance')
    .update({ reason: text || null })
    .eq('player_id', await requirePlayerId(supabase))
    .eq('session_id', sessionId)
    .eq('session_type', sessionType)
    .eq('status', 'not_attending')

  if (error) throw new Error(error.message)

  revalidateTabs('schedule')
})
