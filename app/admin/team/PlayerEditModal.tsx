'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { LEAGUE } from '@/lib/constants'
import { updatePlayer } from './actions'
import { PlayerPhotoField } from '@/components/PlayerPhotoField'
import { FormButtons, FormError, PositionPicker, hintCls, inputCls, labelCls } from '@/components/form'

/** What the admin profile knows about how this player can be edited */
export type EditContext = {
  seasonLabel: string
  /**
   * season  — in the selected open season's squad: edits that season's number
   * archived — in the selected archived season's squad: number is read-only
   * default — not in the selected season: edits the number they take into new seasons
   */
  jerseyMode: 'season' | 'archived' | 'default'
  /** Has a login account — the email is then fixed */
  hasAccount: boolean
  /** Viewing yourself — your own role can't be changed */
  isSelf: boolean
}

export type EditablePlayer = {
  id: string
  full_name: string
  preferred_name: string | null
  email?: string | null
  role?: 'player' | 'admin'
  position: string[] | null
  date_of_birth?: string | null
  is_active: boolean
  jersey_number: number | null
  photo_path?: string | null
}

/**
 * Admin-only edit of a player's details, opened from their profile. A bottom
 * sheet on phones, a centred dialog on desktop (shared Modal), above the profile.
 */
export default function PlayerEditModal({
  player,
  context,
  onClose,
}: {
  player: EditablePlayer
  context: EditContext
  onClose: () => void
}) {
  const router = useRouter()
  const [positions, setPositions] = useState<string[]>(player.position ?? [])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const num = (name: string) => {
      const v = ((fd.get(name) as string | null) ?? '').trim()
      return v === '' ? null : Number(v)
    }
    setError(null)
    startTransition(async () => {
      try {
        await updatePlayer(player.id, {
          full_name: fd.get('full_name') as string,
          preferred_name: (fd.get('preferred_name') as string) || null,
          // Disabled inputs aren't submitted: keep the existing email then
          email: context.hasAccount ? player.email ?? null : ((fd.get('email') as string) || null),
          role: context.isSelf ? player.role ?? 'player' : (fd.get('role') as 'player' | 'admin'),
          position: positions,
          date_of_birth: (fd.get('date_of_birth') as string) || null,
          is_active: fd.get('is_active') === 'on',
          jersey_number: context.jerseyMode === 'archived' ? player.jersey_number : num('jersey_number'),
        })
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  const jerseyLabel =
    context.jerseyMode === 'default' ? 'Jersey # (default for new seasons)' : `Jersey # (${LEAGUE} ${context.seasonLabel})`

  return (
    <Modal onClose={onClose} layer="top" scrollable>
      <h2 className="mb-5 text-lg font-bold text-white">Edit player</h2>
      {/* Saves on its own, straight away — not part of the form's Save */}
      <div className="mb-4">
        <PlayerPhotoField playerId={player.id} photoPath={player.photo_path ?? null} />
      </div>
      <form onSubmit={handleSubmit} className="liga-player-edit space-y-4">
        <div>
          <label className={labelCls} htmlFor="edit-full-name">Full name *</label>
          <input id="edit-full-name" name="full_name" required defaultValue={player.full_name} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="edit-preferred">Preferred name</label>
          <input id="edit-preferred" name="preferred_name" defaultValue={player.preferred_name ?? ''} placeholder="Auto (first name)" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="edit-email">Email</label>
          <input
            id="edit-email"
            name="email"
            type="email"
            defaultValue={player.email ?? ''}
            disabled={context.hasAccount}
            placeholder="Leave blank if not known yet"
            className={inputCls}
          />
          <p className={hintCls}>
            {context.hasAccount
              ? 'They have an account — this is their login and can’t be changed here.'
              : 'Their login. Blank = pending (no invite link until it’s set).'}
          </p>
        </div>

        <div>
          <span className={labelCls}>Positions</span>
          <PositionPicker value={positions} onChange={setPositions} />
          <p className={hintCls}>Every position they play — the same across all seasons.</p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls} htmlFor="edit-jersey">{jerseyLabel}</label>
            <input
              id="edit-jersey"
              name="jersey_number"
              type="number"
              min="0"
              max="99"
              defaultValue={player.jersey_number ?? ''}
              disabled={context.jerseyMode === 'archived'}
              placeholder="—"
              className={inputCls}
            />
            {context.jerseyMode === 'archived' && <p className={hintCls}>Archived season — read-only.</p>}
          </div>
          <div className="flex-1">
            <label className={labelCls} htmlFor="edit-role">Role</label>
            <select id="edit-role" name="role" defaultValue={player.role ?? 'player'} disabled={context.isSelf} className={inputCls}>
              <option value="player">Player</option>
              <option value="admin">Admin</option>
            </select>
            {context.isSelf && <p className={hintCls}>You can’t change your own role.</p>}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="edit-dob">Date of birth</label>
          <input id="edit-dob" name="date_of_birth" type="date" defaultValue={player.date_of_birth ?? ''} className={inputCls} />
          <p className={hintCls}>Years at ORA is worked out from their first season played.</p>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-surface-border px-3 py-2.5">
          <input type="checkbox" name="is_active" defaultChecked={player.is_active} className="mt-0.5 h-4 w-4 rounded accent-brand" />
          <span className="text-sm text-white">
            Active
            <span className="block text-[11px] text-slate-500">Inactive players are hidden from open seasons&apos; squad lists; their stats stay.</span>
          </span>
        </label>

        <FormError error={error} />

        <FormButtons isPending={isPending} onCancel={onClose} />
      </form>
    </Modal>
  )
}
