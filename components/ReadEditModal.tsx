'use client'

import type { ReactNode } from 'react'
import Modal from './Modal'

export type ReadEditModalProps = {
  title: string
  titleAction?: ReactNode
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
  /** Render the admin Edit trigger in the header (next to titleAction) instead of the footer. */
  editInHeader?: boolean
  /** Render in place as a page panel (desktop master–detail) instead of a modal. No Close buttons. */
  inline?: boolean
}

export function ReadEditModal({
  title,
  titleAction,
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
  editInHeader = false,
  inline = false,
}: ReadEditModalProps) {
  if (!isOpen) return null

  const content = (
    <>
      <div className="liga-modal-header mb-5 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-lg font-bold text-white">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {titleAction}
          {editInHeader && isAdmin && !editMode && (
            <button
              type="button"
              onClick={onEnterEdit}
              className="liga-compact-button liga-button-secondary shrink-0 rounded-lg border border-surface-border px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-700"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {children}

      {/* Action buttons — an inline panel has nothing to close */}
      {isAdmin && !editMode && !(inline && editInHeader) && (
        <div className="liga-actions flex gap-2 pt-3">
          {!inline && (
            <button
              type="button"
              onClick={onClose}
              className="liga-compact-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-700"
            >
              Close
            </button>
          )}
          {!editInHeader && (
            <button
              type="button"
              onClick={onEnterEdit}
              className="liga-compact-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-700"
            >
              Edit
            </button>
          )}
        </div>
      )}

      {isAdmin && editMode && (
        <div className="liga-actions space-y-2 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={isPending}
              className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isPending}
              className="liga-button liga-button-primary bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="liga-button liga-button-danger w-full rounded-lg border border-red-900/60 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-900/20 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Non-admin (player) only sees Close */}
      {!isAdmin && !inline && (
        <div className="liga-actions pt-3">
          <button
            type="button"
            onClick={onClose}
            className="liga-compact-button liga-button-secondary w-full rounded-lg border border-surface-border py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      )}
    </>
  )

  if (inline) {
    return (
      <section aria-label={title} className="liga-detail-panel card p-5">
        {content}
      </section>
    )
  }
  return (
    <Modal onClose={onClose} scrollable>
      {content}
    </Modal>
  )
}
