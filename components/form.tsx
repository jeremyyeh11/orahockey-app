// Shared pieces for the app's modal forms (add/edit event, poll, player,
// profile, fines). In the app shell, `.liga-ui input.liga-field` also fixes
// inputs at 42px, so date and text inputs line up.

import { POSITIONS } from '@/lib/constants'

/** Text, date and select fields. color-scheme keeps native date/time pickers dark. */
export const inputCls =
  'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50 [color-scheme:dark]'
export const labelCls = 'mb-1 block text-xs font-medium text-slate-400'
/** Small help text under a field */
export const hintCls = 'mt-1 text-[11px] text-slate-500'

/** A form's error message, or nothing */
export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="liga-alert liga-alert-error rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
}

/**
 * Cancel + the primary action, side by side at the foot of a modal form. The
 * primary button submits the form, or calls `onConfirm` when there's no form.
 */
export function FormButtons({
  onCancel,
  isPending,
  label = 'Save',
  pendingLabel = 'Saving…',
  disabled = false,
  onConfirm,
}: {
  onCancel: () => void
  isPending: boolean
  label?: string
  pendingLabel?: string
  /** Extra reason to disable the primary button (it's always disabled while pending) */
  disabled?: boolean
  onConfirm?: () => void
}) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
      >
        Cancel
      </button>
      <button
        type={onConfirm ? 'button' : 'submit'}
        onClick={onConfirm}
        disabled={isPending || disabled}
        className="liga-button liga-button-primary bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? pendingLabel : label}
      </button>
    </div>
  )
}

/** Toggle buttons for a player's positions (FWD / MID / DEF / GK), any number */
export function PositionPicker({ value, onChange }: { value: string[]; onChange: (positions: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Positions">
      {POSITIONS.map((pos) => {
        const on = value.includes(pos)
        return (
          <button
            key={pos}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((p) => p !== pos) : [...value, pos])}
            className={`liga-button min-h-[44px] rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              on
                ? 'bg-accent border-transparent text-white ring-1 ring-white/10'
                : 'border-surface-border text-slate-400 hover:border-slate-500 hover:text-white'
            }`}
          >
            {pos}
          </button>
        )
      })}
    </div>
  )
}
