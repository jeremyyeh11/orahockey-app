'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setAttendance(
  sessionId: string,
  sessionType: 'game' | 'training',
  status: 'attending' | 'not_attending' | 'maybe'
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: me, error: meError } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (meError || !me) throw new Error('No player record linked to this account')

  const { error } = await supabase.from('attendance').upsert(
    {
      player_id: me.id,
      session_id: sessionId,
      session_type: sessionType,
      status,
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'player_id,session_id,session_type' }
  )

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/schedule')
  revalidatePath('/dashboard')
  revalidatePath('/admin/schedule')
}
