'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { preferredName, splitName, sortPositions } from './RosterList'
import type { LeaderboardRow, PlayerLite } from '@/lib/stats'

function calcAge(dob: string): number {
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

export type ProfilePlayer = PlayerLite & {
  position: string[] | null
  is_active: boolean
  email?: string
  role?: 'player' | 'admin'
  date_of_birth?: string | null
  joined_year?: number | null
}

// Inline stat row — same compact style as squad cards
function StatLine({ row, positions }: { row: LeaderboardRow; positions: string[] | null }) {
  const isGK = positions?.includes('GK') ?? false
  const isOutfield = positions?.some((p) => p !== 'GK') ?? false

  const showGoals = isOutfield
  const showCS = isGK

  const valCls = (v: number) => v > 0 ? 'text-white' : 'text-slate-600'
  const lblCls = 'text-white/50'

  const cols: { label: string; value: number }[] = []
  if (showGoals) {
    cols.push({ label: 'FG', value: row.fg })
    cols.push({ label: 'PC', value: row.pc })
    cols.push({ label: 'PS', value: row.ps })
    cols.push({ label: 'A', value: row.assists })
  }
  if (showCS) cols.push({ label: 'CS', value: row.cleanSheets })
  cols.push({ label: 'POTM', value: row.potmWins })

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px]">
      {cols.map((c) => (
        <span key={c.label} className="inline-flex items-baseline gap-0.5">
          <span className={`font-semibold ${valCls(c.value)}`}>{c.value > 0 ? c.value : '–'}</span>
          <span className={lblCls}>{c.label}</span>
        </span>
      ))}
    </div>
  )
}

function CardBadges({ row }: { row: LeaderboardRow }) {
  const { green, yellow, red } = row.cards
  if (green === 0 && yellow === 0 && red === 0) return null
  return (
    <div className="flex items-center gap-1.5">
      {green > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs">
          <span className="text-green-400">▲</span>
          <span className="text-slate-300">{green}</span>
        </span>
      )}
      {yellow > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs">
          <span className="text-yellow-400">■</span>
          <span className="text-slate-300">{yellow}</span>
        </span>
      )}
      {red > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs">
          <span className="text-red-400">●</span>
          <span className="text-slate-300">{red}</span>
        </span>
      )}
    </div>
  )
}

export function PlayerProfilePage({
  player,
  seasonRow,
  careerRow,
  seasonLabel,
}: {
  player: ProfilePlayer
  seasonRow: LeaderboardRow | undefined
  careerRow: LeaderboardRow | undefined
  seasonLabel: string
}) {
  const router = useRouter()
  const { before, beforeSep, preferred, afterSep, after } = splitName(player)
  const positions = sortPositions(player.position)

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
    {/* Background layer — extends behind header to avoid seam */}
    <div className="fixed inset-0 z-[29] bg-gradient-to-b from-brand/25 via-surface-card to-surface-card" />

    <div className="fixed inset-0 top-[3.5rem] z-[60] overflow-hidden scrollbar-hide">

      {/* Large faded jersey number — aligned with back button */}
      {player.jersey_number != null && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-1 select-none font-display text-[7rem] font-extrabold leading-none text-white/8"
        >
          {player.jersey_number}
        </span>
      )}

      {/* Player image — real photo scaled to cover, silhouette fallback */}
      <div className="absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/players/${player.id}.png`}
          alt={preferredName(player)}
          className="h-full w-full object-cover object-top opacity-90"
          onError={(e) => {
            const img = e.currentTarget
            img.style.display = 'none'
            const fallback = img.nextElementSibling
            if (fallback) (fallback as HTMLElement).style.display = 'flex'
          }}
        />
        <svg
          viewBox="0 0 100 130"
          className="h-[55vh] w-auto opacity-25"
          fill="currentColor"
          style={{ display: 'none', position: 'absolute', top: '2rem', left: '50%', transform: 'translateX(-50%)' }}
        >
          <circle cx="50" cy="18" r="12" />
          <path d="M32 40 Q50 30 68 40 L68 72 L63 72 L63 48 L58 48 L58 130 L53 130 L53 72 L47 72 L47 130 L42 130 L42 48 L37 48 L37 72 L32 72 Z" />
        </svg>
      </div>

      {/* Fade image out at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-surface-card via-surface-card/80 to-transparent" />

      {/* Back button — top left */}
      <button
        onClick={() => router.back()}
        className="fixed left-4 top-[4.5rem] z-[70] flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition hover:bg-black/50"
        aria-label="Back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {/* Layer 2: Translucent stats overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pb-6">
        {/* Gradient fade for name */}
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pt-12 pb-2">
          {/* Name — hero scale to match the jersey watermark */}
          <div className="font-display font-extrabold uppercase leading-[0.95] text-white">
            {before && <span className="text-xl font-semibold tracking-wide text-slate-300">{before}{beforeSep}</span>}
            <span className="text-5xl">{preferred}</span>
            {after && <span className="text-xl font-semibold tracking-wide text-slate-300">{afterSep}{after}</span>}
          </div>

          {/* Age | Years with ORA | Total Caps — spread across full width */}
          <div className="mt-3 flex items-baseline justify-between text-slate-200">
            {player.date_of_birth && (
              <span className="text-base">
                <span className="font-bold text-white">{calcAge(player.date_of_birth)}</span> yrs
              </span>
            )}
            {player.joined_year && (
              <span className="text-base">
                <span className="font-bold text-white">{new Date().getFullYear() - player.joined_year}</span> yrs with ORA
              </span>
            )}
            {careerRow && careerRow.caps > 0 && (
              <span className="text-base">
                <span className="font-bold text-white">{careerRow.caps}</span> caps
              </span>
            )}
          </div>

          {/* Positions */}
          {positions.length > 0 && (
            <div className="mt-1.5 flex gap-1.5">
              {positions.map((pos) => (
                <span key={pos} className="rounded bg-white/[0.1] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                  {pos}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Translucent stat panel */}
        {seasonRow && (
          <div className="bg-black/50 backdrop-blur-sm px-6 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {seasonLabel}
              </span>
              <CardBadges row={seasonRow} />
            </div>
            <StatLine row={seasonRow} positions={player.position} />
          </div>
        )}

        {/* Career stats */}
        {careerRow && (
          <div className="bg-black/70 backdrop-blur-sm px-6 py-3">
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Career
              </span>
            </div>
            <StatLine row={careerRow} positions={player.position} />
          </div>
        )}

        {/* No stats */}
        {!seasonRow && !careerRow && (
          <div className="bg-black/50 backdrop-blur-sm px-6 py-4">
            <p className="text-center text-sm text-slate-500">No stats recorded yet.</p>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
