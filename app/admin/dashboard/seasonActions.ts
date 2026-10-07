'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin Danger zone: archive the current season and make the next one current
 * (close_current_season(), one transaction). The caller must have typed CLOSE;
 * the database function re-checks that the caller is an admin.
 */
export async function closeSeason(confirmation: string): Promise<{ newLabel: string }> {
  if (confirmation !== 'CLOSE') throw new Error('Type CLOSE to confirm.')

  const supabase = createClient()
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
  if (adminError || isAdmin !== true) throw new Error('Only admins can close a season.')

  const { data, error } = await supabase.rpc('close_current_season')
  if (error) throw new Error(error.message)

  // Every page shows season data
  revalidatePath('/', 'layout')
  return { newLabel: data as string }
}
