// Shared shape for a poll row (with its options and votes) as loaded by the
// admin and player polls pages. Both PollsClients render from this.
export type Poll = {
  id: string
  question: string
  is_active: boolean
  closes_at: string | null
  created_at: string
  /** Reply deadline and whether missing it is fined (lib/fines.ts) */
  respond_by?: string | null
  fines_enabled?: boolean
  poll_options: { id: string; label: string; sort_order: number }[]
  poll_votes: { id: string; poll_option_id: string; player_id: string; voted_at?: string }[]
}
