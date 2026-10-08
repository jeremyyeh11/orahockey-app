'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Set your picks on an open poll to exactly `optionIds` — tap-to-vote, switch,
 * add/remove (multiple answers) and retract (empty list) all go through here.
 * set_poll_vote() checks the poll is open and the one-answer rule.
 */
export async function setPollVote(pollId: string, optionIds: string[]) {
  const supabase = createClient()

  const { error } = await supabase.rpc('set_poll_vote', { p_poll_id: pollId, p_option_ids: optionIds })
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/polls')
  revalidatePath('/admin/polls')
}
