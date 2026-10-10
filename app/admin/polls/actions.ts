'use server'

import { createClient } from '@/lib/supabase/server'
import { action, requireAdmin, requirePlayerId, revalidateTabs, teamId } from '@/lib/action-helpers'

export const createPoll = action(async (
  question: string,
  options: string[],
  closesAt: string | null,
  multipleChoice: boolean,
  fines: { respond_by: string | null; fines_enabled: boolean }
) => {
  if (fines.respond_by && Number.isNaN(new Date(fines.respond_by).getTime())) throw new Error('Respond by is not a valid date.')

  const supabase = createClient()
  await requireAdmin(supabase)

  const [team, me] = await Promise.all([teamId(supabase), requirePlayerId(supabase)])

  const { data: poll, error } = await supabase
    .from('polls')
    .insert({
      team_id: team,
      created_by: me,
      question,
      closes_at: closesAt,
      multiple_choice: multipleChoice,
      is_active: true,
      ...fines,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  const { error: optError } = await supabase.from('poll_options').insert(
    options.map((label, i) => ({ poll_id: poll.id, label, sort_order: i }))
  )

  if (optError) throw new Error(optError.message)
  revalidateTabs('polls', 'home')
})

export const setPollActive = action(async (id: string, isActive: boolean) => {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { error } = await supabase.from('polls').update({ is_active: isActive }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('polls', 'home')
})

export const deletePoll = action(async (id: string) => {
  const supabase = createClient()
  await requireAdmin(supabase)

  const { error } = await supabase.from('polls').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTabs('polls', 'home')
})
