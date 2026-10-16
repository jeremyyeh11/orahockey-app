'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { action, requireSuperadmin } from '@/lib/action-helpers'

/**
 * Superadmin Danger zone: archive the current season and make the next one current
 * (close_current_season(), one transaction). The caller must have typed CLOSE;
 * the database function re-checks that the caller is the superadmin (039).
 */
export const closeSeason = action(async (confirmation: string): Promise<{ newLabel: string }> => {
  if (confirmation !== 'CLOSE') throw new Error('Type CLOSE to confirm.')

  const supabase = createClient()
  await requireSuperadmin(supabase)

  const { data, error } = await supabase.rpc('close_current_season')
  if (error) throw new Error(error.message)

  // Every page shows season data
  revalidatePath('/', 'layout')
  return { newLabel: data as string }
})
