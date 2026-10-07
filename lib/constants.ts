// Club-wide display constants. Keep human-facing branding strings here so they
// aren't scattered as literals across pages (and don't drift out of sync).

export const CLUB_NAME = 'ORA Hockey'
export const LEAGUE = 'MHL1'

/** How each games.game_type reads in the app: League vs Friendly (playoff kept for old data) */
export const GAME_TYPE_LABEL: Record<string, string> = {
  regular: 'League',
  playoff: 'Playoff',
  exhibition: 'Friendly',
}

/** Playing positions, in display order */
export const POSITIONS = ['FWD', 'MID', 'DEF', 'GK'] as const
