'use client'

import type { ReactNode } from 'react'

export type ReadEditModalProps = {
  title: string
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
  editMode: boolean
  onEnterEdit: () => void
  onSave: () => void
  onDiscard: () => void
  isPending: boolean
  children: ReactNode
  onDelete?: () => void
}

export function ReadEditModal({
  title,
  isOpen,
  onClose,
  isAdmin,
  editMode,
  onEnterEdit,
  onSave,
  onDiscard,
  isPending,
  children,
  onDelete,
}: ReadEditModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-card px-6 pb-8 pt-6 shadow-xl sm:max-w-sm sm:rounded-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
        <h2 className="mb-5 text-lg font-bold text-white">{title}</h2>

        {children}

        {/* Action buttons */}
        {isAdmin && !editMode && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onEnterEdit}
                className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
              >
                Edit
              </button>
            </div>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="w-full rounded-lg border border-red-900/60 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-900/20 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {isAdmin && editMode && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onDiscard}
                disabled={isPending}
                className="flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isPending}
                className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="w-full rounded-lg border border-red-900/60 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-900/20 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {/* Non-admin (player) only sees Close */}
        {!isAdmin && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
