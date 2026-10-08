'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function revalidate() {
  revalidatePath('/admin/polls')
  revalidatePath('/admin/dashboard')
  revalidatePath('/dashboard/polls')
  revalidatePath('/dashboard')
}

export async function createPoll(
  question: string,
  options: string[],
  closesAt: string | null,
  multipleChoice: boolean,
  fines: { respond_by: string | null; fines_enabled: boolean }
) {
  if (fines.respond_by && Number.isNaN(new Date(fines.respond_by).getTime())) throw new Error('Respond by is not a valid date.')

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: team }, { data: me }] = await Promise.all([
    supabase.from('teams').select('id').limit(1).single(),
    supabase.from('players').select('id').eq('auth_user_id', user?.id ?? '').single(),
  ])

  const { data: poll, error } = await supabase
    .from('polls')
    .insert({
      team_id: team?.id ?? null,
      created_by: me?.id ?? null,
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
  revalidate()
}

export async function setPollActive(id: string, isActive: boolean) {
  const supabase = createClient()

  const { error } = await supabase.from('polls').update({ is_active: isActive }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}

export async function deletePoll(id: string) {
  const supabase = createClient()

  const { error } = await supabase.from('polls').delete().eq('id', id)

  if (error) throw new Error(error.message)
  revalidate()
}
