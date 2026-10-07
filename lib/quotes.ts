// Lines for the Home season card outside the season proper. Plain and practical,
// not slogans. One is picked at random per page load.

/** Pre-season: preparation for the season ahead */
export const PRE_SEASON_QUOTES = [
  'The season is mostly won before the first fixture.',
  'Turn up to every session. Consistency beats intensity.',
  'Fitness now is goals saved in the fourth quarter.',
  'Get the basics automatic now, so they hold up under pressure.',
  'Preparation is the one part of the game you fully control.',
  'Build the habits now. They carry you when you’re tired.',
  'Good seasons are built on unglamorous trainings.',
  'Every rep now is one less mistake on match day.',
]

/** Post-season: credit the work, recover, then look ahead */
export const POST_SEASON_QUOTES = [
  'Take credit for the work. Then rest properly.',
  'Recovery is part of training. Take the break.',
  'Rest, reflect, reset.',
  'Keep the lessons, drop the fatigue.',
  'Look back once, then look ahead.',
  'Proud of the season. Come back fresh.',
  'Sleep, eat well, switch off. Next season starts rested.',
  'What worked this season is next season’s starting point.',
]

export function pickQuote(quotes: string[]) {
  return quotes[Math.floor(Math.random() * quotes.length)]
}
