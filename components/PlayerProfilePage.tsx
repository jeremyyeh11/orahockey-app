'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nameParts, preferredName, sortPositions } from './RosterList'
import type { LeaderboardRow, PlayerLite } from '@/lib/stats'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import Modal from './Modal'
import { startNavigationProgress } from './NavigationProgress'
import { generateSetupLink, type SetupLink } from '@/app/admin/team/inviteActions'
import { addPlayersToSeason, removePlayerFromSeason, setPlayerEmail, togglePlayerActive } from '@/app/admin/team/actions'
import type { AccountStatus } from './RosterList'
import { PencilIcon } from './icons'
import PlayerEditModal, { type EditContext } from '@/app/admin/team/PlayerEditModal'

export type { AccountStatus }

/** Admin view, open season only: the player's place in the selected season's squad */
export type SquadStatus = {
  seasonLabel: string
  inSquad: boolean
  /** Has stats / appearances that season — can't be removed, only marked inactive */
  hasRecord: boolean
  isActive: boolean
}

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
  pending: { text: 'Pending — no email yet', dot: 'border border-slate-400 bg-transparent' },
  none: { text: 'No account yet', dot: 'bg-slate-500' },
  invited: { text: 'Invited — not claimed', dot: 'bg-amber-400' },
  active: { text: 'Active', dot: 'bg-green-400' },
}

type PlayerProfileProps = {
  player: ProfilePlayer
  seasonRow: LeaderboardRow | undefined
  careerRow: LeaderboardRow | undefined
  /** e.g. "MHL1 2027"; null for "All time" — then only the Career panel shows */
  seasonLabel: string | null
  /** Admin view only — enables the account/invite panel */
  accountStatus?: AccountStatus
  /** Admin view, open season only — enables the squad (add / remove / inactive) panel */
  squadStatus?: SquadStatus
  /** Admin view only — enables the Edit button and form */
  editContext?: EditContext
}

export function PlayerProfilePage({
  player,
  seasonRow,
  careerRow,
  seasonLabel,
  accountStatus,
  squadStatus,
  editContext,
  presentation = 'page',
}: PlayerProfileProps & {
  /**
   * `page` — the /team/[id] route: full screen below the app header.
   * `dialog` / `fullScreen` — opened over the Squad list: a centred dialog on
   * desktop, a full-page modal (covering header and nav) on touch layouts.
   */
  presentation?: 'page' | 'dialog' | 'fullScreen'
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

  // Pending players: add the email that unlocks their invite link (admin view only)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailSaving(true)
    setLinkError(null)
    try {
      await setPlayerEmail(player.id, emailDraft)
      setEmailDraft('')
      router.refresh()
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setEmailSaving(false)
    }
  }

  // Edit player details (admin view only)
  const [showEdit, setShowEdit] = useState(false)
  const editButton = (position: string) =>
    editContext ? (
      <button
        onClick={() => setShowEdit(true)}
        className={`liga-icon-button flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 ${position}`}
        aria-label="Edit player"
      >
        <PencilIcon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>
    ) : null
  const editModal = editContext && showEdit && (
    <PlayerEditModal player={player} context={editContext} onClose={() => setShowEdit(false)} />
  )

  // Squad membership (admin view only)
  const [squadPending, setSquadPending] = useState(false)
  const [squadError, setSquadError] = useState<string | null>(null)

  async function runSquadAction(action: () => Promise<void>) {
    setSquadPending(true)
    setSquadError(null)
    try {
      await action()
      router.refresh()
    } catch (err) {
      setSquadError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSquadPending(false)
    }
  }

  function handleRemoveFromSeason() {
    if (!squadStatus) return
    if (!confirm(`Remove ${preferredName(player)} from the ${seasonLabel} squad?`)) return
    runSquadAction(() => removePlayerFromSeason(player.id))
  }

  const whatsappText = link
    ? `Hi ${preferredName(player)} — here's your private ORA Hockey app ${
        link.kind === 'invite' ? 'setup' : 'password reset'
      } link. Open it and set your password:\n\n${link.url}\n\n(The link expires in ${link.expiresIn} — ask me for a new one if it stops working.)`
    : ''
  const parts = nameParts(player)
  const partsKey = parts.map((x) => `${x.highlight ? '*' : ''}${x.text}`).join('|')
  const positions = sortPositions(player.position)

  // Keep the whole name on one line: the preferred words stay a fixed 48px, the
  // rest of the full name auto-shrinks to fit the remaining width.
  const nameRef = useRef<HTMLDivElement>(null)

  useIsoLayoutEffect(() => {
    const container = nameRef.current
    if (!container) return

    const fit = () => {
      const rest = Array.from(container.querySelectorAll<HTMLElement>('[data-name-part="rest"]'))
      const prefs = Array.from(container.querySelectorAll<HTMLElement>('[data-name-part="pref"]'))
      // Reset to the class-based base size before measuring natural width.
      rest.forEach((el) => (el.style.fontSize = ''))
      const restW = rest.reduce((w, el) => w + el.offsetWidth, 0)
      if (restW === 0) return
      const base = parseFloat(getComputedStyle(rest[0]).fontSize) || 20
      const available = container.clientWidth - prefs.reduce((w, el) => w + el.offsetWidth, 0) - 6
      if (available > 0 && restW > available) {
        const size = Math.max(9, base * (available / restW))
        rest.forEach((el) => (el.style.fontSize = `${size}px`))
      }
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [partsKey])

  // Only the touch page view is a fixed overlay that needs the page frozen behind
  // it; overlays get their lock from Modal, and the desktop page is a normal page.
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  useModalScrollLock(presentation === 'page' && !isDesktop)
  const pathname = usePathname()
  const squadPath = pathname.replace(/\/[^/]+$/, '') // /admin/team/123 → /admin/team

  // Photo, name and stat panels — shared by the full-screen and dialog layouts
  const body = (
    <>
      {/* Large faded jersey number — aligned with back button */}
      {player.jersey_number != null && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-1 select-none font-display text-[7rem] font-extrabold leading-none text-white/[0.08]"
        >
          {player.jersey_number}
        </span>
      )}

      {/* Player image — real photo scaled to cover, silhouette fallback */}
      <div className="liga-profile-image absolute inset-0 overflow-hidden">
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

      {/* Layer 2: Translucent stats overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pb-6">
        {/* Gradient fade for name */}
        <div className="liga-profile-identity bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pt-12 pb-2">
          {/* Name — preferred words fixed at 48px wherever they sit in the full name,
              the rest auto-shrinks to stay one line. Spaces are non-breaking: a
              plain space at the edge of a flex item is stripped, which ran "AKASH"
              into "PREBHASH". */}
          <div
            ref={nameRef}
            className="flex items-baseline overflow-hidden whitespace-nowrap font-display text-xl font-extrabold uppercase leading-[0.95] text-white"
          >
            {parts.map((part, i) =>
              part.highlight ? (
                <span key={i} data-name-part="pref" className="text-5xl">
                  {part.text.replace(/ /g, '\u00a0')}
                </span>
              ) : (
                <span key={i} data-name-part="rest" className="font-semibold tracking-wide text-slate-300">
                  {part.text.replace(/ /g, '\u00a0')}
                </span>
              )
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
                <span key={pos} className="liga-position-label text-[10px] font-medium text-slate-300">
                  {pos}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Translucent stat panel — the selected season first, career below */}
        {seasonLabel === null ? null : seasonRow ? (
          <div className="liga-profile-panel bg-black/50 backdrop-blur-sm px-6 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {seasonLabel}
              </span>
              <CardBadges row={seasonRow} />
            </div>
            <StatLine row={seasonRow} positions={player.position} />
          </div>
        ) : careerRow ? (
          <div className="liga-profile-panel bg-black/50 backdrop-blur-sm px-6 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {seasonLabel}
            </span>
            <p className="mt-0.5 text-[11px] text-slate-500">No stats this season yet.</p>
          </div>
        ) : null}

        {/* Career stats */}
        {careerRow && (
          <div className="liga-profile-panel bg-black/70 backdrop-blur-sm px-6 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Career
              </span>
              {/* With "All time" selected this is the only panel, so it carries the cards */}
              {seasonLabel === null && <CardBadges row={careerRow} />}
            </div>
            <StatLine row={careerRow} positions={player.position} />
          </div>
        )}

        {/* No stats */}
        {!seasonRow && !careerRow && (
          <div className="liga-profile-panel bg-black/50 backdrop-blur-sm px-6 py-4">
            <p className="text-center text-sm text-slate-500">No stats recorded yet.</p>
          </div>
        )}

        {/* Squad panel — admin view, open season only */}
        {squadStatus && (
          <div className="liga-profile-panel liga-squad-panel bg-black/70 backdrop-blur-sm px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {seasonLabel} squad
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-200">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      !squadStatus.inSquad ? 'bg-slate-500' : squadStatus.isActive ? 'bg-green-400' : 'bg-amber-400'
                    }`}
                  />
                  <span className="truncate">
                    {!squadStatus.inSquad ? 'Not in squad' : squadStatus.isActive ? 'In squad' : 'In squad · inactive'}
                  </span>
                </div>
              </div>
              {!squadStatus.inSquad ? (
                <button
                  onClick={() => runSquadAction(() => addPlayersToSeason([player.id]))}
                  disabled={squadPending}
                  className="liga-button liga-button-primary bg-accent shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
                >
                  {squadPending ? 'Adding…' : `Add to ${squadStatus.seasonLabel}`}
                </button>
              ) : squadStatus.hasRecord ? (
                <button
                  onClick={() => runSquadAction(() => togglePlayerActive(player.id, !squadStatus.isActive))}
                  disabled={squadPending}
                  className="liga-button liga-button-secondary shrink-0 rounded-lg border border-surface-border px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {squadPending ? 'Saving…' : squadStatus.isActive ? 'Mark inactive' : 'Mark active'}
                </button>
              ) : (
                <button
                  onClick={handleRemoveFromSeason}
                  disabled={squadPending}
                  className="liga-button liga-button-secondary shrink-0 rounded-lg border border-red-900/60 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/30 disabled:opacity-50"
                >
                  {squadPending ? 'Removing…' : `Remove from ${squadStatus.seasonLabel}`}
                </button>
              )}
            </div>
            {squadStatus.inSquad && squadStatus.hasRecord && (
              <p className="mt-1 text-[11px] text-slate-500">
                Has {squadStatus.seasonLabel} appearances or stats, so they stay in the squad.
              </p>
            )}
            {squadError && (
              <p className="liga-alert liga-alert-error mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-300">{squadError}</p>
            )}
          </div>
        )}

        {/* Account / invite panel — admin view only */}
        {accountStatus && (
          <div className="liga-profile-panel bg-black/80 backdrop-blur-sm px-6 py-3">
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
              {accountStatus !== 'pending' && (
                <button
                  onClick={handleGenerateLink}
                  disabled={linkLoading}
                  className="liga-button liga-button-primary bg-accent shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
                >
                  {linkLoading
                    ? 'Creating…'
                    : accountStatus === 'active'
                      ? 'Password reset link'
                      : accountStatus === 'invited'
                        ? 'New invite link'
                        : 'Invite link'}
                </button>
              )}
            </div>
            {/* Pending: add their email first — it's their login and unlocks the invite link */}
            {accountStatus === 'pending' && (
              <form onSubmit={handleSaveEmail} className="liga-add-email mt-2 flex gap-2">
                <input
                  type="email"
                  required
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="Their email"
                  aria-label="Player email"
                  className="liga-field min-h-[44px] min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <button
                  type="submit"
                  disabled={emailSaving || !emailDraft.trim()}
                  className="liga-button liga-button-primary bg-accent shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
                >
                  {emailSaving ? 'Saving…' : 'Save email'}
                </button>
              </form>
            )}
            {linkError && (
              <p className="liga-alert liga-alert-error mt-2 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-300">{linkError}</p>
            )}
          </div>
        )}
      </div>
    </>
  )

  // Invite / reset link — opens over either layout
  const linkModal = link && (
        <Modal onClose={() => setLink(null)} layer="top">
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
            className="liga-field mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-xs text-slate-300 focus:border-brand focus:outline-none"
          />

          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="liga-button liga-button-primary bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border py-2.5 text-center text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              WhatsApp
            </a>
          </div>

          <button
            onClick={() => setLink(null)}
            className="liga-button liga-button-secondary mt-3 w-full rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
          >
            Close
          </button>
        </Modal>
  )

  // Opened from the Squad list, which stays mounted underneath. Closing goes back
  // in history, which drops the intercepted /team/[id] URL.
  if (presentation !== 'page') {
    const fullScreen = presentation === 'fullScreen'
    return (
      <Modal onClose={() => router.back()} size="md" bare fullScreen={fullScreen}>
        <div
          className={`liga-profile-screen relative overflow-hidden bg-gradient-to-b from-brand/25 via-surface-card to-surface-card ${
            fullScreen ? 'h-full' : 'h-[min(85vh,680px)]'
          }`}
        >
          <h2 className="sr-only">{player.full_name}</h2>
          {body}
          {/* Phones keep the familiar back arrow; the desktop dialog gets a close X */}
          <button
            onClick={() => router.back()}
            className={`liga-icon-button absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition hover:bg-black/50 ${
              fullScreen ? 'left-4 top-4' : 'right-3 top-3'
            }`}
            aria-label={fullScreen ? 'Back' : 'Close'}
          >
            {fullScreen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            )}
          </button>
          {/* Edit sits opposite the back arrow on phones, beside the close X in the dialog */}
          {editButton(`absolute z-10 ${fullScreen ? 'right-4 top-4' : 'right-14 top-3'}`)}
        </div>
        {linkModal}
        {editModal}
      </Modal>
    )
  }

  // The page itself is only reached by a direct link, refresh or bookmark (clicks
  // from Squad open the overlay), so Back goes to Squad rather than history.
  // Touch layouts: full screen below the header. Desktop (lg+): the same card as
  // the dialog, centred in the page — done in CSS so there's no layout flash.
  return (
    <>
    {/* Background layer — extends behind header to avoid seam */}
    <div className="liga-profile-backdrop fixed inset-0 z-[29] bg-gradient-to-b from-brand/25 via-surface-card to-surface-card lg:hidden" />

    <div className="liga-profile-screen fixed inset-0 top-[3.5rem] z-[60] overflow-hidden scrollbar-hide lg:relative lg:inset-auto lg:z-auto lg:mx-auto lg:my-6 lg:h-[min(85vh,680px)] lg:max-w-lg lg:rounded-2xl lg:border lg:border-surface-border lg:bg-gradient-to-b lg:from-brand/25 lg:via-surface-card lg:to-surface-card lg:shadow-xl">
      <h1 className="sr-only">{player.full_name}</h1>
      {body}

      {/* Back to Squad — top left */}
      <button
        onClick={() => {
          startNavigationProgress()
          router.push(squadPath)
        }}
        className="liga-icon-button fixed left-4 top-[4.5rem] z-[70] flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition hover:bg-black/50 lg:absolute lg:top-4 lg:z-10"
        aria-label="Back to Squad"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {editButton('fixed right-4 top-[4.5rem] z-[70] lg:absolute lg:top-4 lg:z-10')}

      {linkModal}
      {editModal}
    </div>
    </>
  )
}

/**
 * Profile opened from a Squad list (intercepted `/team/[id]` route): a dialog
 * over the list on desktop, a full-page modal on touch layouts. Both are real
 * modals so nothing of the list underneath can show through.
 */
export function PlayerProfileOverlay(props: PlayerProfileProps) {
  const pathname = usePathname()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  // A parallel-route slot keeps its last page across soft navigations within
  // /team (e.g. clicking "Squad" in the nav), so only render on the profile URL.
  if (!pathname.endsWith(`/team/${props.player.id}`)) return null
  return <PlayerProfilePage {...props} presentation={isDesktop ? 'dialog' : 'fullScreen'} />
}
