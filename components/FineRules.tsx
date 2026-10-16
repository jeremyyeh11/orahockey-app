'use client'

import { useState } from 'react'
import { FINE_AMOUNT, RSVP_LABEL } from '@/lib/fines'

const DEADLINES: [string, string][] = [
  ['Weekend match or training', 'Thursday 23:59 before'],
  ['Weekday training', 'Sunday 23:59 before'],
  ['Weekday match', '72h before the start'],
  ['Team event or poll', '72h after it’s posted'],
]

/**
 * "How fines work" on the Fines tab: the club's rules in plain words, behind a
 * toggle under the intro so the month's fines stay on top. Mirrors lib/fines.ts
 * (computeFines, defaultRespondBy, defaultFinesEnabled) — update both together.
 */
export function FineRules() {
  const [open, setOpen] = useState(false)

  const section = (title: string, children: React.ReactNode) => (
    <div>
      <h3 className="liga-section-title mb-1.5">{title}</h3>
      {children}
    </div>
  )
  const list = (items: React.ReactNode[]) => (
    <ul className="list-disc space-y-1 pl-4 marker:text-slate-600">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )

  return (
    <div className="liga-fine-rules mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[32px] items-center gap-1.5 text-xs font-medium text-brand-light transition hover:text-white"
      >
        How fines work
        <span aria-hidden="true" className={`inline-block text-slate-500 transition ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="liga-fine-rules-body card mt-2 space-y-4 p-4 text-xs leading-relaxed text-slate-300">
          {section(
            `What gets you fined ($${FINE_AMOUNT} each)`,
            list([
              <><span className="font-semibold text-white">Late reply</span> — replying after the Reply by deadline, or not replying at all. Your first reply is the one that counts.</>,
              <><span className="font-semibold text-white">Late change</span> — changing your RSVP within 24h of the start without telling the coaching committee.</>,
              <><span className="font-semibold text-white">Still on {RSVP_LABEL.maybe}</span> — counts as a late reply if you haven’t picked In or Out by 24h before the start (or by the Reply by deadline, if that’s later).</>,
              'At most one fine per person per match, training, event or poll.',
            ])
          )}

          {section(
            'Reply by (Singapore time)',
            <>
              <div className="divide-y divide-white/5">
                {DEADLINES.map(([what, when]) => (
                  <div key={what} className="flex items-baseline justify-between gap-3 py-1">
                    <span>{what}</span>
                    <span className="text-right text-slate-400">{when}</span>
                  </div>
                ))}
              </div>
              <p className="liga-meta mt-1.5 text-slate-500">
                Never later than the event’s start or the poll’s close. These are the defaults — each entry shows its own Reply by.
              </p>
            </>
          )}

          {section(
            'Who can be fined',
            list([
              'Matches, trainings and events: every active squad member, app account or not. Admins add replies from the sheet.',
              'Polls: only players with an app account. Anonymous polls too — the app knows you voted, not what you picked.',
            ])
          )}

          {section(
            'No fines',
            list([
              'Team events, unless an admin switches fines on.',
              'Anything posted after its own deadline.',
              'Player of the match voting.',
              'Entries marked No fines in their details.',
              'A cancelled or postponed entry: fines from before it was called off stay, no new ones after.',
            ])
          )}

          {section(
            'Paying',
            list([
              'A late reply counts in the month its deadline passed; a late change in the month it was made.',
              'The Finemaster marks fines paid or waives them. Had a good reason? Tell the Finemaster.',
            ])
          )}
        </div>
      )}
    </div>
  )
}
