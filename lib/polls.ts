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
  /** Reply deadline and whether missing it is fined (lib/fines.ts) */
  respond_by?: string | null
  fines_enabled?: boolean
  poll_options: { id: string; label: string; sort_order: number }[]
  /** One row per player per picked option */
  poll_votes: { id: string; poll_option_id: string; player_id: string; voted_at?: string }[]
}

export const POLL_SELECT =
  'id, question, is_active, closes_at, created_at, multiple_choice, respond_by, fines_enabled, poll_options(id, label, sort_order), poll_votes(id, poll_option_id, player_id, voted_at)'

/** Open for voting: active and not past its close time */
export const isPollOpen = (poll: Pick<Poll, 'is_active' | 'closes_at'>, nowMs: number) =>
  poll.is_active && (!poll.closes_at || new Date(poll.closes_at).getTime() > nowMs)

/** How many players have voted (a multiple-answer vote is several rows) */
export const voterCount = (votes: { player_id: string }[]) => new Set(votes.map((v) => v.player_id)).size
