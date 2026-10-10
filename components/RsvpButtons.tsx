import type { MyStatus } from '@/components/EventRow'
import { RSVP_LABEL } from '@/lib/fines'

const CHOICES = (['attending', 'maybe', 'not_attending'] as const).map((s) => [s, RSVP_LABEL[s]] as const)

// On the green featured card: white for "I'm in" so it still stands out on green
const ACCENT: Record<MyStatus | 'idle', string> = {
  attending: 'bg-white text-brand-dark',
  maybe: 'bg-amber-300 text-amber-950',
  not_attending: 'bg-black/35 text-white',
  idle: 'border border-white/25 text-white/85 hover:bg-white/10 hover:text-white',
}

// On a grey card or row
const PLAIN: Record<MyStatus | 'idle', string> = {
  attending: 'bg-accent text-white ring-1 ring-white/10',
  maybe: 'bg-amber-900/60 text-amber-300',
  not_attending: 'bg-slate-700 text-slate-300',
  idle: 'border border-surface-border text-slate-300 hover:border-slate-500 hover:text-white',
}

/**
 * I'm in / Update later / Out as one compact group of bordered buttons (the picked one
 * filled) — Home's Next up cards and the schedule's upcoming rows. Capped at
 * max-w-sm on desktop so it never spreads across a wide row. Stateless: the
 * caller owns the status and saving. `onAccent` styles it for the green card.
 */
export function RsvpButtons({
  value,
  onPick,
  disabled = false,
  onAccent = false,
  className = '',
}: {
  value: MyStatus | null | undefined
  onPick: (status: MyStatus) => void
  disabled?: boolean
  onAccent?: boolean
  className?: string
}) {
  const styles = onAccent ? ACCENT : PLAIN
  return (
    <div className={`liga-rsvp flex gap-2 lg:max-w-sm ${className}`}>
      {CHOICES.map(([choice, label]) => (
        <button
          key={choice}
          type="button"
          onClick={() => onPick(choice)}
          disabled={disabled}
          aria-pressed={value === choice}
          className={`liga-button flex-1 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-60 ${styles[value === choice ? choice : 'idle']}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
