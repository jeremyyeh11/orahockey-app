// Shared shape for a poll row (with its options and votes) as loaded by the
// admin and player polls pages. Both PollsClients render from this.
export type Poll = {
  id: string
  question: string
  is_active: boolean
  closes_at: string | null
  created_at: string
  /** Pick any number of options instead of one (Telegram's "multiple answers") */
  multiple_choice?: boolean
  /** Nobody sees what anyone picked, admins included — only who voted and the totals (041). Fixed at creation */
  anonymous?: boolean
  /** Reply deadline and whether missing it is fined (lib/fines.ts) */
  respond_by?: string | null
  fines_enabled?: boolean
  poll_options: { id: string; label: string; sort_order: number }[]
  /** One row per player per picked option: your own, plus everyone's on a public poll (RLS) */
  poll_votes: { id: string; poll_option_id: string; player_id: string; voted_at?: string }[]
  /** Who voted and when (earliest current vote), from poll_voters() — never what they picked */
  voters: { player_id: string; voted_at: string }[]
  /** Votes per option id, from poll_tallies() */
  tallies: Record<string, number>
}

export type PollVoterRow = { poll_id: string; player_id: string; voted_at: string }
export type PollTallyRow = { poll_id: string; poll_option_id: string; votes: number }

/** Attach poll_voters() / poll_tallies() rows to the polls they belong to */
export function withVoteSummary<T extends Omit<Poll, 'voters' | 'tallies'>>(polls: T[], voters: PollVoterRow[], tallies: PollTallyRow[]): (T & Pick<Poll, 'voters' | 'tallies'>)[] {
  return polls.map((p) => ({
    ...p,
    voters: voters.filter((v) => v.poll_id === p.id).map(({ player_id, voted_at }) => ({ player_id, voted_at })),
    tallies: Object.fromEntries(tallies.filter((t) => t.poll_id === p.id).map((t) => [t.poll_option_id, t.votes])),
  }))
}

export const POLL_SELECT =
  'id, question, is_active, closes_at, created_at, multiple_choice, anonymous, respond_by, fines_enabled, poll_options(id, label, sort_order), poll_votes(id, poll_option_id, player_id, voted_at)'

/** Open for voting: active and not past its close time */
export const isPollOpen = (poll: Pick<Poll, 'is_active' | 'closes_at'>, nowMs: number) =>
  poll.is_active && (!poll.closes_at || new Date(poll.closes_at).getTime() > nowMs)

