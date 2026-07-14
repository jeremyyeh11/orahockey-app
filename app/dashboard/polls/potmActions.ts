'use server'

// Vote-POTM actions (backlog #5). The eligibility checks, secret-ballot storage,
// auto-close and 3/2/1 tally all live in the cast_potm_vote / close_potm_poll
// definer functions — this just forwards the ranked pick and revalidates.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function castPotmVote(
  pollId: string,
  firstId: string,
  secondId: string,
  thirdId: string
) {
  const supabase = createClient()

  const { error } = await supabase.rpc('cast_potm_vote', {
    p_poll_id: pollId,
    p_first: firstId,
    p_second: secondId,
    p_third: thirdId,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/polls')
  revalidatePath('/admin/polls')
  // A poll may have auto-closed and written placings the match views read.
  revalidatePath('/dashboard/schedule')
  revalidatePath('/admin/schedule')
  revalidatePath('/dashboard/team')
  revalidatePath('/admin/team')
}
