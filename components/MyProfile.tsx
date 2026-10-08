'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import SignOutButton from '@/components/SignOutButton'
import { preferredName, sortPositions } from '@/components/RosterList'
import { POSITIONS } from '@/lib/constants'
import type { LeaderboardRow } from '@/lib/stats'
import { updateMyProfile } from '@/app/dashboard/profile/actions'

export type MyProfileData = {
  player: {
    id: string
    full_name: string
    preferred_name: string | null
    jersey_number: number | null
    position: string[] | null
    date_of_birth: string | null
    email: string | null
    role: 'player' | 'admin'
    photoUrl: string | null
  }
  /** Seasons they've been in the squad for, newest first */
  /** From their first squad season to now; `played` false = not in that season's squad */
  seasons: {
    label: string
    current: boolean
    jersey: number | null
    played: boolean
    /** Stats the season kept (lib/season recordedStats): goals, goal_types, assists, cards, potm */
    recorded: string[]
    row: LeaderboardRow | null
  }[]
  career: LeaderboardRow | null
  /** First season with a league appearance, e.g. '2026' */
  firstSeason: string | null
  /** From the first season played to the current one, inclusive */
  yearsAtClub: number | null
}

function age(dob: string) {
  const b = new Date(`${dob}T00:00:00`)
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--
  return a
}

/** '14 Mar 1999' */
const fmtDob = (dob: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dob}T00:00:00Z`))

const goalsOf = (r: LeaderboardRow | null) => r?.goals ?? 0

// The goal-type breakdown columns (FG/PC/PS): a lower tier than G and A
const MUTED = 'text-[10px] font-medium text-slate-600'
const MUTED_CELL = 'text-xs font-normal text-slate-500'
const cardCount = (r: LeaderboardRow | null) => (r ? r.cards.green + r.cards.yellow + r.cards.red : 0)

/**
 * Your own profile (the Profile tab) — a stats-page layout: an identity panel
 * (photo, name, career line, big tiles, Edit / Sign out), per-appearance rates,
 * your details, and every season's numbers with a career total. League games
 * only. The Squad card stays the condensed public view.
 */
export default function MyProfile({ data }: { data: MyProfileData }) {
  const { player, seasons, career, firstSeason, yearsAtClub } = data
  const [editing, setEditing] = useState(false)
  const positions = sortPositions(player.position ?? [])
  const isGK = positions.includes('GK')
  const apps = career?.caps ?? 0
  const goals = goalsOf(career)
  const assists = career?.assists ?? 0
  const potm = career?.potmWins ?? 0

  // Rates: the average of each season's rate, over the seasons that recorded
  // that stat and where they played — older seasons that didn't keep it (2025:
  // nothing; 2024: no assists) would otherwise dilute it
  const rateOf = (stat: string, of: (r: LeaderboardRow) => number) => {
    const rated = seasons.filter((s) => s.played && (s.row?.caps ?? 0) > 0 && s.recorded.includes(stat))
    return {
      seasons: rated.length,
      value: rated.length ? rated.reduce((sum, s) => sum + of(s.row!) / s.row!.caps, 0) / rated.length : 0,
    }
  }
  const rates = [
    { label: 'Goals/app', ...rateOf('goals', goalsOf), max: 1, pct: false },
    { label: 'Assists/app', ...rateOf('assists', (r) => r.assists), max: 1, pct: false },
    { label: 'POTM %', ...rateOf('potm', (r) => r.potmWins), max: 1, pct: true },
  ]

  return (
    <div className="liga-page liga-my-profile p-4">
      <div className="liga-page-header mb-4">
        <h1 className="liga-page-title text-white">Profile</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        {/* ── Identity panel ── */}
        <section className="liga-profile-panel card overflow-hidden">
          <div className="relative aspect-[4/3] bg-surface">
            {player.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.photoUrl} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <svg viewBox="0 0 100 130" className="absolute left-1/2 top-4 h-[85%] w-auto -translate-x-1/2 text-white/15" fill="currentColor" aria-hidden="true">
                <circle cx="50" cy="18" r="12" />
                <path d="M32 40 Q50 30 68 40 L68 72 L63 72 L63 48 L58 48 L58 130 L53 130 L53 72 L47 72 L47 130 L42 130 L42 48 L37 48 L37 72 L32 72 Z" />
              </svg>
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-surface-card to-transparent" />
            {player.jersey_number != null && (
              <span aria-hidden className="absolute right-3 top-1 font-display text-6xl font-extrabold leading-none text-white/20">
                {player.jersey_number}
              </span>
            )}
          </div>

          <div className="px-4 pb-4">
            <div className="-mt-6 relative">
              <div className="font-display text-3xl font-extrabold uppercase leading-none text-white">{preferredName(player)}</div>
              <div className="liga-meta mt-1 text-slate-400">{player.full_name}</div>
              {positions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {positions.map((p) => (
                    <span key={p} className="liga-position-label rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Career line */}
            <div className="liga-profile-career mt-4 grid grid-cols-4 border-y border-surface-border py-3 text-center">
              {[
                ['Apps', apps],
                [isGK && goals === 0 ? 'CS' : 'Goals', isGK && goals === 0 ? career?.cleanSheets ?? 0 : goals],
                ['Assists', assists],
                ['POTM', potm],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div className="liga-meta uppercase text-slate-500">{label}</div>
                  <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">{value}</div>
                </div>
              ))}
            </div>

            {/* Big tiles */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/[0.04] p-3 text-center">
                <div className="liga-meta text-slate-400">Seasons</div>
                <div className="mt-1 font-display text-4xl font-extrabold leading-none text-white">{seasons.filter((s) => s.played).length}</div>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3 text-center">
                <div className="liga-meta text-slate-400">Years at ORA</div>
                <div className="mt-1 font-display text-4xl font-extrabold leading-none text-white">{yearsAtClub ?? '—'}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="liga-button liga-button-primary bg-accent w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
              >
                Edit profile
              </button>
              <SignOutButton />
            </div>
          </div>
        </section>

        <div className="min-w-0 space-y-4">
          {/* ── Rates ── */}
          <section className="grid grid-cols-3 gap-3">
            {rates.map((r) => (
              <div key={r.label} className="liga-profile-rate card p-3">
                <div className="liga-meta text-slate-400">{r.label}</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
                  {r.pct ? `${Math.round(r.value * 100)}%` : r.value.toFixed(2)}
                </div>
                <div className="liga-meta mt-0.5 text-slate-500">
                  {r.seasons ? `avg of ${r.seasons} season${r.seasons === 1 ? '' : 's'}` : 'no recorded seasons'}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-brand-light" style={{ width: `${Math.min(100, (r.value / r.max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </section>

          {/* ── Details ── */}
          <section className="card p-4">
            <h2 className="liga-section-title mb-3">Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {(
                [
                  ['Preferred name', preferredName(player)],
                  ['Date of birth', player.date_of_birth ? `${fmtDob(player.date_of_birth)} (${age(player.date_of_birth)})` : '—'],
                  ['Positions', positions.join(', ') || '—'],
                  ['Jersey', player.jersey_number != null ? `#${player.jersey_number}` : '—'],
                  ['First season', firstSeason ?? '—'],
                  ['Email', player.email ?? '—'],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="liga-meta text-slate-500">{k}</dt>
                  <dd className="mt-0.5 break-words text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Stats by season ── */}
          <section className="card p-4">
            <h2 className="liga-section-title mb-3">Stats by season</h2>
            {seasons.length === 0 && !career ? (
              <p className="text-sm text-slate-500">No stats yet.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="liga-profile-seasons w-full min-w-[30rem] text-right text-sm tabular-nums">
                  <thead>
                    <tr className="liga-meta text-slate-500">
                      <th className="py-1.5 text-left font-medium">Season</th>
                      <th className="font-medium">Apps</th>
                      <th className="font-medium" title="Goals">G</th>
                      <th className="font-medium" title="Assists">A</th>
                      {isGK && <th className="font-medium" title="Clean sheets">CS</th>}
                      <th className="pr-4 font-medium">POTM</th>
                      {/* Goal types: the breakdown of G — smaller and greyer */}
                      <th className={`${MUTED} border-l border-surface-border pl-4`} title="Field goals">FG</th>
                      <th className={MUTED} title="Penalty corners">PC</th>
                      <th className={MUTED} title="Penalty strokes">PS</th>
                      <th className="font-medium">Cards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasons.map((s) => (
                      <tr key={s.label} className={`border-t border-surface-border ${s.played ? 'text-slate-200' : 'text-slate-500'}`}>
                        <td className="py-2 text-left font-semibold text-white">
                          {s.label}
                          {s.current && <span className="liga-meta ml-1.5 font-normal text-brand-light">now</span>}
                        </td>
                        <td>{s.row?.caps ?? 0}</td>
                        {!s.played ? (
                          <td colSpan={isGK ? 8 : 7} className="liga-meta text-center text-slate-500">
                            Didn&apos;t play this season
                          </td>
                        ) : s.recorded.length > 0 ? (
                          <>
                            {/* — = not recorded that season */}
                            <td>{s.recorded.includes('goals') ? goalsOf(s.row) : '—'}</td>
                            <td>{s.recorded.includes('assists') ? s.row?.assists ?? 0 : '—'}</td>
                            {isGK && <td>{s.row?.cleanSheets ?? 0}</td>}
                            <td className="pr-4">{s.recorded.includes('potm') ? s.row?.potmWins ?? 0 : '—'}</td>
                            <td className={`${MUTED_CELL} border-l border-surface-border pl-4`}>{s.recorded.includes('goal_types') ? s.row?.fg ?? 0 : '—'}</td>
                            <td className={MUTED_CELL}>{s.recorded.includes('goal_types') ? s.row?.pc ?? 0 : '—'}</td>
                            <td className={MUTED_CELL}>{s.recorded.includes('goal_types') ? s.row?.ps ?? 0 : '—'}</td>
                            <td>{s.recorded.includes('cards') ? cardCount(s.row) : '—'}</td>
                          </>
                        ) : (
                          <td colSpan={isGK ? 8 : 7} className="liga-meta text-center text-slate-500">
                            Stats not recorded for this season
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-surface-border font-semibold text-white">
                      <td className="py-2 text-left">Career</td>
                      <td>{apps}</td>
                      <td>{goals}</td>
                      <td>{assists}</td>
                      {isGK && <td>{career?.cleanSheets ?? 0}</td>}
                      <td className="pr-4">{potm}</td>
                      <td className={`${MUTED_CELL} border-l border-surface-border pl-4`}>{career?.fg ?? 0}</td>
                      <td className={MUTED_CELL}>{career?.pc ?? 0}</td>
                      <td className={MUTED_CELL}>{career?.ps ?? 0}</td>
                      <td>{cardCount(career)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="liga-meta mt-2 text-slate-500">
              League games only — friendlies don&apos;t count. Older seasons kept fewer stats (— = not recorded; 2025 only appearances, 2024 goals and MOTM); rates average the seasons that recorded each stat.
            </p>
          </section>
        </div>
      </div>

      {editing && <EditMyProfile player={player} onClose={() => setEditing(false)} />}
    </div>
  )
}

const inputCls =
  'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand [color-scheme:dark]'
const labelCls = 'mb-1 block text-xs font-medium text-slate-400'

/** What a player may change about themselves: preferred name, date of birth, positions */
function EditMyProfile({ player, onClose }: { player: MyProfileData['player']; onClose: () => void }) {
  const router = useRouter()
  const [positions, setPositions] = useState<string[]>(player.position ?? [])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await updateMyProfile({
          preferred_name: (fd.get('preferred_name') as string) || null,
          date_of_birth: (fd.get('date_of_birth') as string) || null,
          position: positions,
        })
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <Modal onClose={onClose} scrollable>
      <h2 className="mb-5 text-lg font-bold text-white">Edit profile</h2>
      <form onSubmit={submit} className="liga-my-profile-edit space-y-4">
        <div>
          <label className={labelCls} htmlFor="me-preferred">Preferred name</label>
          <input id="me-preferred" name="preferred_name" defaultValue={player.preferred_name ?? ''} maxLength={40} placeholder="Auto (first name)" className={inputCls} />
          <p className="mt-1 text-[11px] text-slate-500">What the app calls you — e.g. on Home and in squad lists.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="me-dob">Date of birth</label>
          <input id="me-dob" name="date_of_birth" type="date" defaultValue={player.date_of_birth ?? ''} className={`${inputCls} h-[42px]`} />
          <p className="mt-1 text-[11px] text-slate-500">Shown on your profile to the whole team.</p>
        </div>
        <div>
          <span className={labelCls}>Positions</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Positions">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                aria-pressed={positions.includes(pos)}
                onClick={() => setPositions((prev) => (prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]))}
                className={`liga-button min-h-[44px] rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  positions.includes(pos)
                    ? 'bg-accent border-transparent text-white ring-1 ring-white/10'
                    : 'border-surface-border text-slate-400 hover:border-slate-500 hover:text-white'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Your photo, name, jersey number and email are managed by the coaches.</p>
        {error && <p className="liga-alert liga-alert-error rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="liga-button liga-button-secondary flex-1 rounded-lg border border-surface-border text-sm font-medium text-slate-300 transition hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="liga-button liga-button-primary bg-accent flex-1 rounded-lg text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
