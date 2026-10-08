// Player photos live in the public `player-photos` Storage bucket (020); a
// player row stores the object's path. Uploaded by admins only.

export const PHOTO_BUCKET = 'player-photos'

/** Public URL of a player's photo, or null for the silhouette */
export function playerPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
}
