'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/action-helpers'

/**
 * Admin Danger zone: archive the current season and make the next one current
 * (close_current_season(), one transaction). The caller must have typed CLOSE;
 * the database function re-checks that the caller is an admin.
 */
export async function closeSeason(confirmation: string): Promise<{ newLabel: string }> {
  if (confirmation !== 'CLOSE') throw new Error('Type CLOSE to confirm.')

  const supabase = createClient()
  await requireAdmin(supabase)

  const { data, error } = await supabase.rpc('close_current_season')
  if (error) throw new Error(error.message)

  // Every page shows season data
  revalidatePath('/', 'layout')
  return { newLabel: data as string }
}
