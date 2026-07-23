'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { preferredName, splitName, sortPositions } from './RosterList'
import type { LeaderboardRow, PlayerLite } from '@/lib/stats'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { generateSetupLink, type SetupLink } from '@/app/admin/team/inviteActions'

export type AccountStatus = 'none' | 'invited' | 'active'

// useLayoutEffect on the server warns; fall back to useEffect there.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/** One stat: value on top, label below (e.g. 27y / AGE). */
function StatCol({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-2xl font-bold leading-none text-white">{value}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  )
}

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

const ACCOUNT_LABEL: Record<AccountStatus, { text: string; dot: string }> = {
  none: { text: 'No account yet', dot: 'bg-slate-500' },
  invited: { text: 'Invited — not claimed', dot: 'bg-amber-400' },
  active: { text: 'Active', dot: 'bg-green-400' },
}

export function PlayerProfilePage({
  player,
  seasonRow,
  careerRow,
  seasonLabel,
  accountStatus,
}: {
  player: ProfilePlayer
  seasonRow: LeaderboardRow | undefined
  careerRow: LeaderboardRow | undefined
  seasonLabel: string
  /** Admin view only — enables the account/invite panel */
  accountStatus?: AccountStatus
}) {
  const router = useRouter()

  // Invite link generation (admin view only)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [link, setLink] = useState<SetupLink | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerateLink() {
    setLinkLoading(true)
    setLinkError(null)
    setCopied(false)
    try {
      setLink(await generateSetupLink(player.id))
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLinkLoading(false)
    }
  }

  async function handleCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — the link is selectable in the input
    }
  }

  const whatsappText = link
    ? `Hi ${preferredName(player)} — here's your private ORA Hockey app ${
        link.kind === 'invite' ? 'setup' : 'password reset'
      } link. Open it and set your password:\n\n${link.url}\n\n(The link expires in ${link.expiresIn} — ask me for a new one if it stops working.)`
    : ''
  const { before, beforeSep, preferred, afterSep, after } = splitName(player)
  const positions = sortPositions(player.position)

  // Keep the whole name on one line: preferred stays a fixed 48px, the rest of
  // the full name auto-shrinks to fit the remaining width.
  const nameRef = useRef<HTMLDivElement>(null)
  const preferredRef = useRef<HTMLSpanElement>(null)
  const beforeRef = useRef<HTMLSpanElement>(null)
  const afterRef = useRef<HTMLSpanElement>(null)

  useIsoLayoutEffect(() => {
    const container = nameRef.current
    const pref = preferredRef.current
    if (!container || !pref) return

    const fit = () => {
      const b = beforeRef.current
      const a = afterRef.current
      // Reset to the class-based base size before measuring natural width.
      if (b) b.style.fontSize = ''
      if (a) a.style.fontSize = ''
      const restW = (b?.offsetWidth ?? 0) + (a?.offsetWidth ?? 0)
      if (restW === 0) return
      const base = parseFloat(getComputedStyle(b ?? a!).fontSize) || 20
      const available = container.clientWidth - pref.offsetWidth - 6
      if (available > 0 && restW > available) {
        const size = Math.max(9, base * (available / restW))
        if (b) b.style.fontSize = `${size}px`
        if (a) a.style.fontSize = `${size}px`
      }
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [before, beforeSep, preferred, afterSep, after])

  useModalScrollLock()

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
          {/* Name — preferred fixed at 48px, rest auto-shrinks to stay one line */}
          <div
            ref={nameRef}
            className="flex items-baseline overflow-hidden whitespace-nowrap font-display text-xl font-extrabold uppercase leading-[0.95] text-white"
          >
            {before && (
              <span ref={beforeRef} className="font-semibold tracking-wide text-slate-300">{before}{beforeSep}</span>
            )}
            <span ref={preferredRef} className="text-5xl">{preferred}</span>
            {after && (
              <span ref={afterRef} className="font-semibold tracking-wide text-slate-300">{afterSep}{after}</span>
            )}
          </div>

          {/* Age · Years with ORA · Appearances — value over label, full width */}
          <div className="mt-3 flex items-end justify-between">
            {player.date_of_birth && (
              <StatCol value={`${calcAge(player.date_of_birth)}y`} label="Age" />
            )}
            {player.joined_year && (
              <StatCol value={`${new Date().getFullYear() - player.joined_year}y`} label="At ORA" />
            )}
            {careerRow && careerRow.caps > 0 && (
              <StatCol value={careerRow.caps} label="App" />
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

        {/* Account / invite panel — admin view only */}
        {accountStatus && (
          <div className="bg-black/80 backdrop-blur-sm px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Account
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-200">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${ACCOUNT_LABEL[accountStatus].dot}`} />
                  <span className="truncate">{ACCOUNT_LABEL[accountStatus].text}</span>
                </div>
              </div>
              <button
                onClick={handleGenerateLink}
                disabled={linkLoading}
                className="bg-accent shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
              >
                {linkLoading
                  ? 'Creating…'
                  : accountStatus === 'active'
                    ? 'Password reset link'
                    : accountStatus === 'invited'
                      ? 'New invite link'
                      : 'Invite link'}
              </button>
            </div>
            {linkError && (
              <p className="mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-300">{linkError}</p>
            )}
          </div>
        )}
      </div>

      {/* Invite link modal */}
      {link && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setLink(null)} />
          <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface-card border border-surface-border px-6 pt-6 pb-8 shadow-xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
            <h2 className="text-lg font-bold text-white mb-1">
              {link.kind === 'invite' ? 'Invite link ready' : 'Reset link ready'}
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Send this private link to {preferredName(player)} — they&apos;ll set their own
              password. It expires in {link.expiresIn}; generate a new one any time.
            </p>

            <input
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
              className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-xs text-slate-300 focus:border-brand focus:outline-none"
            />

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
              >
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg border border-surface-border py-2.5 text-center text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                WhatsApp
              </a>
            </div>

            <button
              onClick={() => setLink(null)}
              className="mt-3 w-full rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
