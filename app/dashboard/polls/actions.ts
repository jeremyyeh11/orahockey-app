'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function votePoll(pollId: string, optionId: string) {
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

  const { error } = await supabase.from('poll_votes').insert({
    poll_id: pollId,
    poll_option_id: optionId,
    player_id: me.id,
  })

  if (error) {
    if (error.code === '23505') throw new Error('You have already voted in this poll')
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/polls')
  revalidatePath('/admin/polls')
}
