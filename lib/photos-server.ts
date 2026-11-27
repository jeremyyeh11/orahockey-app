// Saving a player's photo path, shared by the admin action (Squad → Edit player)
// and the player's own (Profile → Edit). A plain module, not 'use server', so
// it isn't a callable endpoint: each action checks who may call it first.

import type { createClient } from '@/lib/supabase/server'
import { revalidateTabs } from '@/lib/action-helpers'
import { PHOTO_BUCKET } from '@/lib/photos'

type Supabase = ReturnType<typeof createClient>

/**
 * Point the player at `path` (an object just uploaded to their folder in the
 * bucket) or null for the silhouette, then delete the photo it replaces. RLS,
 * the self-update guard and the own-folder check (043) back this up in the
 * database.
 */
export async function savePlayerPhoto(supabase: Supabase, playerId: string, path: string | null) {
  if (path && !path.startsWith(`${playerId}/`)) throw new Error('That photo belongs to another player.')

  const { data: current, error: readError } = await supabase.from('players').select('photo_path').eq('id', playerId).single()
  if (readError) throw new Error(readError.message)

  const { data: updated, error } = await supabase.from('players').update({ photo_path: path }).eq('id', playerId).select('id')
  if (error) throw new Error(error.message)
  if (!updated?.length) throw new Error("You can't change that player's photo.")

  if (current.photo_path && current.photo_path !== path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([current.photo_path])
  }
  revalidateTabs('team', 'schedule', 'profile')
}
