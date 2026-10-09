'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PHOTO_BUCKET, playerPhotoUrl } from '@/lib/photos'
import { setPlayerPhoto } from '@/app/admin/team/actions'
import { unwrap } from '@/lib/action-result'

const MAX_SIDE = 1200

/** Downscale to MAX_SIDE and re-encode as WebP (keeps transparency for cut-out photos) */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image.'))), 'image/webp', 0.9)
  )
}

/**
 * Admin-only photo for a player (backlog #7): shows the current photo, uploads a
 * new one straight from the browser to Storage (only admins may write the
 * bucket), then saves its path. Live immediately; Remove goes back to the
 * silhouette. Separate from the edit form's Save.
 */
export function PlayerPhotoField({ playerId, photoPath }: { playerId: string; photoPath: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState(photoPath)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const url = playerPhotoUrl(path)

  async function upload(file: File) {
    setError(null)
    setBusy(true)
    try {
      const blob = await shrink(file)
      const name = `${playerId}/${Date.now()}.webp`
      const { error: upErr } = await createClient().storage.from(PHOTO_BUCKET).upload(name, blob, { contentType: 'image/webp' })
      if (upErr) throw new Error(upErr.message)
      await unwrap(setPlayerPhoto(playerId, name))
      setPath(name)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setError(null)
    setBusy(true)
    try {
      await unwrap(setPlayerPhoto(playerId, null))
      setPath(null)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="liga-photo-field">
      <span className="mb-1 block text-xs font-medium text-slate-400">Photo</span>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-16 shrink-0 items-end justify-center overflow-hidden rounded-lg border border-surface-border bg-surface">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <svg viewBox="0 0 100 130" className="h-16 w-auto text-slate-600" fill="currentColor" aria-hidden="true">
              <circle cx="50" cy="18" r="12" />
              <path d="M32 40 Q50 30 68 40 L68 72 L63 72 L63 48 L58 48 L58 130 L53 130 L53 72 L47 72 L47 130 L42 130 L42 48 L37 48 L37 72 L32 72 Z" />
            </svg>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="liga-button liga-button-secondary rounded-lg border border-surface-border px-3 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-40"
          >
            {busy ? 'Saving…' : url ? 'Replace photo' : 'Upload photo'}
          </button>
          {url && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="liga-button liga-button-danger rounded-lg border border-red-900/60 px-3 text-xs font-semibold text-red-400 transition hover:bg-red-900/20 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload(file)
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Shows straight away. Portrait works best — the card crops to the top.</p>
      {error && <p className="liga-alert liga-alert-error mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}
