'use server'

import { createClient } from '@/lib/supabase/server'
import { action, revalidateTabs } from '@/lib/action-helpers'
import { POSITIONS } from '@/lib/constants'
import { savePlayerPhoto } from '@/lib/photos-server'

/**
 * A player editing their own profile: preferred name, date of birth and
 * positions. RLS limits the update to their own row and the self-update guard
 * (017/020) to exactly these columns.
 */
export const updateMyProfile = action(async (data: { preferred_name: string | null; date_of_birth: string | null; position: string[] }) => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const preferred = data.preferred_name?.trim().toUpperCase() || null
  if (preferred && preferred.length > 40) throw new Error('Preferred name is too long.')
  const dob = data.date_of_birth || null
  if (dob) {
    const d = new Date(`${dob}T00:00:00Z`)
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1930 || d.getTime() > Date.now()) throw new Error('That date of birth looks wrong.')
  }
  const position = POSITIONS.filter((p) => data.position.includes(p))

  const { data: updated, error } = await supabase
    .from('players')
    .update({ preferred_name: preferred, date_of_birth: dob, position })
    .eq('auth_user_id', user.id)
    .select('id')
  if (error) throw new Error(error.message)
  if (!updated?.length) throw new Error('No player record is linked to this account.')

  revalidateTabs('profile', 'team', 'home')
})

/**
 * A player setting (or clearing) their own photo: `path` is the object they
 * just uploaded to their folder in the player-photos bucket (043 lets players
 * write only there). The previous photo's object is deleted.
 */
export const setMyPhoto = action(async (playerId: string, path: string | null) => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: me } = await supabase.from('players').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!me) throw new Error('No player record is linked to this account.')
  if (me.id !== playerId) throw new Error('You can only change your own photo.')

  await savePlayerPhoto(supabase, me.id, path)
})
