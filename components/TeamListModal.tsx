'use client'

import { useState, useEffect } from 'react'
import { preferredName } from './RosterList'
import type { PlayerLite } from './EventDetailModal'
import { saveTeamList, unpublishTeamList, type TeamListEntry } from '@/app/admin/schedule/teamListActions'
import type { Game } from './EventDetailModal'
import type { AttendanceRow } from './EventDetailModal'

type PlayerWithMeta = PlayerLite & {
  position: string[] | null
  jersey_number: number | null
}

export function TeamListModal({
  game,
  roster,
  attendance,
  teamListStatus,
  existingSelections,
  onClose,
  onStatusChange,
}: {
  game: Game
  roster: PlayerWithMeta[]
  attendance: AttendanceRow[]
  teamListStatus: 'draft' | 'published' | null
  existingSelections: Record<string, boolean>
  onClose: () => void
  onStatusChange: (status: 'draft' | 'published') => void
}) {
  // Get players who indicated attending
  const attendingPlayerIds = new Set(
    attendance
      .filter((a) => a.status === 'attending')
      .map((a) => a.player_id)
  )

  // Filter roster to only attending players
  const attendingPlayers = roster
    .filter((p) => attendingPlayerIds.has(p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  // Selection state: player_id -> selected
  const [selections, setSelections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const p of attendingPlayers) {
      init[p.id] = existingSelections[p.id] ?? false
    }
    return init
  })

  const [isPending, setIsPending] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(teamListStatus)

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function togglePlayer(playerId: string) {
    setSelections((prev) => ({ ...prev, [playerId]: !prev[playerId] }))
  }

  function handleSaveDraft() {
    setIsPending(true)
    const entries: TeamListEntry[] = attendingPlayers.map((p) => ({
      player_id: p.id,
      selected: selections[p.id] ?? false,
    }))
    saveTeamList(game.id, entries, 'draft')
      .then(() => {
        setCurrentStatus('draft')
        onStatusChange('draft')
        setIsPending(false)
      })
      .catch((err) => {
        console.error(err)
        setIsPending(false)
      })
  }

  function handlePublish() {
    setIsPending(true)
    const entries: TeamListEntry[] = attendingPlayers.map((p) => ({
      player_id: p.id,
      selected: selections[p.id] ?? false,
    }))
    saveTeamList(game.id, entries, 'published')
      .then(() => {
        setCurrentStatus('published')
        onStatusChange('published')
        setIsPending(false)
      })
      .catch((err) => {
        console.error(err)
        setIsPending(false)
      })
  }

  function handleUnpublish() {
    setIsPending(true)
    unpublishTeamList(game.id)
      .then(() => {
        setCurrentStatus('draft')
        onStatusChange('draft')
        setIsPending(false)
      })
      .catch((err) => {
        console.error(err)
        setIsPending(false)
      })
  }

  function handleSelectAll() {
    setSelections((prev) => {
      const next = { ...prev }
      for (const p of attendingPlayers) {
        next[p.id] = true
      }
      return next
    })
  }

  const isPublished = currentStatus === 'published'
  const isDraft = currentStatus === 'draft'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto scrollbar-hide rounded-t-2xl border border-surface-border bg-surface-card px-6 pb-8 pt-6 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />

        {/* Header */}
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Team List</h2>
          <span className="text-xs text-slate-400">vs {game.opponent}</span>
        </div>
        <p className="mb-4 text-[11px] text-slate-500">
          {attendingPlayers.length} players indicated attending
        </p>

        {/* Status badge */}
        {isPublished && (
          <div className="mb-3 rounded-lg bg-green-900/30 px-3 py-1.5 text-xs font-medium text-green-300">
            Published — visible to all players
          </div>
        )}
        {isDraft && (
          <div className="mb-3 rounded-lg bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-300">
            Draft — not visible to players
          </div>
        )}
        {!currentStatus && (
          <div className="mb-3 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400">
            Not started
          </div>
        )}

        {/* Player list */}
        <div className="space-y-1">
          {/* Column headers + Select All */}
          <div className="flex items-center gap-3 border-b border-white/5 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="flex-1">Player</span>
            <span className="w-16 text-center">Pos</span>
            <span className="w-12 text-center">
              {isPublished ? 'Jersey' : 'In'}
            </span>
          </div>
          {!isPublished && attendingPlayers.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="w-full rounded-lg border border-surface-border py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-700"
            >
              Select All
            </button>
          )}

          {attendingPlayers.map((p) => {
            const isSelected = selections[p.id] ?? false
            const positions = p.position ?? []
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 py-2"
              >
                <span className="flex-1 truncate text-sm text-white">
                  {preferredName(p)}
                </span>
                <span className="w-16 text-center text-[11px] text-slate-400">
                  {positions.join(' ') || '—'}
                </span>
                {isPublished ? (
                  <span className="w-12 text-center text-sm font-semibold text-white">
                    {p.jersey_number ?? '—'}
                  </span>
                ) : (
                  <div className="flex w-12 justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlayer(p.id)}
                      className="h-4 w-4 rounded border-surface-border accent-brand"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div className="mt-5 space-y-2">
          {isPublished ? (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
              className="w-full rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Unpublish'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isPending}
                className="flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPending}
                className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Publish'}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-surface-border py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
