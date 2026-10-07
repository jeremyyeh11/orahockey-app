// Club-wide display constants. Keep human-facing branding strings here so they
// aren't scattered as literals across pages (and don't drift out of sync).

export const CLUB_NAME = 'ORA Hockey'
export const LEAGUE = 'MHL1'
/** Short club name for match titles: "ORA vs Tornados" */
export const CLUB_SHORT = 'ORA'

/** "ORA vs Tornados" */
export function gameTitle(opponent: string) {
  return `${CLUB_SHORT} vs ${opponent}`
}

/** What a game counts in: the league ("MHL1"), or a friendly */
export function competitionLabel(gameType: string | null | undefined) {
  return gameType === 'exhibition' ? 'Friendly' : gameType === 'playoff' ? `${LEAGUE} Playoff` : LEAGUE
}

/** How each games.game_type reads in the app: League vs Friendly (playoff kept for old data) */
export const GAME_TYPE_LABEL: Record<string, string> = {
  regular: 'League',
  playoff: 'Playoff',
  exhibition: 'Friendly',
}

/** Playing positions, in display order */
export const POSITIONS = ['FWD', 'MID', 'DEF', 'GK'] as const
