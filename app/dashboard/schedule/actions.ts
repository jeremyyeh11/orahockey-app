'use server'

import { createClient } from '@/lib/supabase/server'
import { action, requirePlayerId, revalidateTabs } from '@/lib/action-helpers'

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
