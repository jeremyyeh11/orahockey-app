'use client'

import { useState } from 'react'

type GameType = 'regular' | 'playoff' | 'exhibition'

/**
 * League / Friendly segmented switch for the game forms. Submits as a hidden
 * `game_type` field: League = 'regular', Friendly = 'exhibition'. An old
 * 'playoff' game counts as League and keeps its type unless switched.
 */
export function GameTypeSwitch({ defaultValue = 'regular' }: { defaultValue?: GameType }) {
  const [value, setValue] = useState<GameType>(defaultValue)
  const friendly = value === 'exhibition'

  const option = (label: string, on: boolean, next: GameType) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setValue(next)}
      className={`liga-button min-h-[44px] flex-1 rounded-md px-3 text-sm font-semibold transition ${
        on ? 'bg-accent text-white ring-1 ring-white/10' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-400">Game type</span>
      <div role="group" aria-label="Game type" className="liga-game-type flex gap-1 rounded-lg border border-surface-border p-1">
        {option('League', !friendly, friendly ? 'regular' : value)}
        {option('Friendly', friendly, 'exhibition')}
      </div>
      <input type="hidden" name="game_type" value={value} />
    </div>
  )
}
