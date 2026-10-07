const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

// Exercise the real TSX without a build, a browser, or a new test dependency.
// The optional overrides are for Next router/server-action boundaries only.
function createTsLoader(overrides = {}) {
  const cache = new Map()
  function load(file) {
    const base = path.resolve(root, file)
    const filename = [base, `${base}.tsx`, `${base}.ts`].find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    )
    assert.ok(filename, `Cannot resolve source module: ${file}`)
    if (cache.has(filename)) return cache.get(filename).exports
    const loadedModule = { exports: {} }
    cache.set(filename, loadedModule)
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    })
    const localRequire = (specifier) => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier]
      if (specifier.startsWith('@/')) return load(specifier.slice(2))
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(filename), specifier))
      return require(specifier)
    }
    new Function('require', 'module', 'exports', outputText)(localRequire, loadedModule, loadedModule.exports)
    return loadedModule.exports
  }
  return load
}

const load = createTsLoader()
const { default: RosterList } = load('components/RosterList.tsx')
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const textOf = (html) => html.replace(/<[^>]*>/g, '')
const buttonsOf = (html) => html.match(/<button\b[\s\S]*?<\/button>/g) ?? []
const classesOf = (html) => html.match(/class="([^"]*)"/)?.[1] ?? ''
const openingWithClass = (html, name) => {
  const opening = (html.match(/<[a-z][^>]*>/g) ?? []).find((tag) => classesOf(tag).split(/\s+/).includes(name))
  assert.ok(opening, `Rendered markup must expose ${name}`)
  return opening
}
const player = (id, full_name, position = ['FWD'], extra = {}) => ({
  id, full_name, preferred_name: null, jersey_number: null, position, is_active: true, ...extra,
})

function captureRender(Component, props) {
  let tree
  function Capture() {
    tree = Component(props)
    return tree
  }
  const html = render(Capture, {})
  return { html, tree }
}

function findElement(node, predicate) {
  if (!React.isValidElement(node)) return null
  if (predicate(node)) return node
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findElement(child, predicate)
    if (found) return found
  }
  return null
}

test('roster identity is wrap-safe Liga metadata, not clipped names or filled position badges', () => {
  const players = [
    player('b', 'Ben Lee', ['MID']),
    player('a', 'Aaron Tan', ['GK'], { is_active: false }),
    player('me', 'Ishwarpal Verylongunbrokenfamilyname Singh', ['GK', 'FWD'], {
      preferred_name: 'ISH', jersey_number: 17,
    }),
  ]
  const html = render(RosterList, {
    players, myPlayerId: 'me', onSelect() {},
    accountMap: new Map([['me', 'active'], ['a', 'invited'], ['b', 'none']]),
  })
  const cards = buttonsOf(html)
  assert.equal(cards.length, 3)
  assert.match(classesOf(cards[0]), /\bliga-roster-card\b/)
  assert.match(classesOf(cards[0]), /\bbg-accent\b/, 'self card retains the current green accent')
  assert.match(classesOf(cards[1]), /\bopacity-50\b/, 'inactive presentation remains intact')
  assert.deepEqual(cards.map((card) => textOf(card).replace(/^17/, '')), [
    'ISHWARPAL VERYLONGUNBROKENFAMILYNAME SINGHFWDGK',
    'AARON TANGK',
    'BEN LEEMID',
  ], 'self stays first, remaining players alphabetical; substring names keep their separators')
  const name = openingWithClass(cards[0], 'liga-roster-name')
  assert.match(classesOf(name), /\bbreak-words\b/)
  assert.doesNotMatch(classesOf(name), /truncate|whitespace-nowrap/)
  const number = openingWithClass(cards[0], 'liga-roster-number')
  assert.match(classesOf(number), /\btext-xs\b/)
  assert.match(classesOf(number), /\btabular-nums\b/)
  assert.doesNotMatch(classesOf(number), /font-display|font-extrabold|opacity-15/)
  for (const tag of html.match(/<span\b[^>]*class="[^"]*liga-roster-position[^>]*>/g) ?? []) {
    assert.doesNotMatch(classesOf(tag), /\bbg-|\brounded/, 'positions are plain text')
  }
  assert.equal((html.match(/liga-roster-position/g) ?? []).length, 4)
  for (const [title, color] of [
    ['Account active', 'bg-green-400'],
    ['Invited — not claimed yet', 'bg-amber-400'],
    ['No account yet', 'bg-slate-500'],
  ]) {
    assert.match(html, new RegExp(`title="${title}"[^>]*${color}`))
  }
})

test('season-derived roster stats wrap as 12px tabular value-label pairs while keeping GK rules and sanctions', () => {
  const { computeSeason } = load('lib/stats.ts')
  const players = [
    player('me', 'Zulu Both', ['GK', 'FWD']),
    player('gk', 'Keeper Only', ['GK']),
    player('field', 'Alpha Outfield', ['DEF']),
    player('unknown', 'Unknown Position', null),
    player('empty', 'No Recorded Stats', ['MID']),
  ]
  const { leaderboard } = computeSeason({
    players, season: '2026',
    games: [
      { id: 'shutout', game_date: '2026-05-01T12:00:00Z', result: 'win', goals_against: 0 },
      { id: 'played', game_date: '2026-06-01T12:00:00Z', result: 'win', goals_against: 1 },
      { id: 'future', game_date: '2026-07-01T12:00:00Z', result: null, goals_against: 0 },
      { id: 'old', game_date: '2025-05-01T12:00:00Z', result: 'win', goals_against: 0 },
    ],
    stats: [
      { player_id: 'me', game_id: 'shutout', goals_fg: 2, goals_pc: 1, goals_ps: 1, assists: 2 },
      { player_id: 'me', game_id: 'played', goals_fg: 1, goals_pc: 0, goals_ps: 0, assists: 1 },
      { player_id: 'me', game_id: 'old', goals_fg: 100, goals_pc: 0, goals_ps: 0, assists: 0 },
      { player_id: 'gk', game_id: 'shutout', goals_fg: 9, goals_pc: 9, goals_ps: 9, assists: 9 },
      { player_id: 'field', game_id: 'shutout', goals_fg: 0, goals_pc: 2, goals_ps: 1, assists: 4 },
    ],
    potm: [
      { player_id: 'me', game_id: 'shutout', place: 1 },
      { player_id: 'me', game_id: 'played', place: 2 },
    ],
    attendance: [
      ...['shutout', 'played', 'future', 'old'].map((session_id) => ({ player_id: 'me', session_id })),
      ...['shutout', 'played'].map((session_id) => ({ player_id: 'gk', session_id })),
      { player_id: 'field', session_id: 'shutout' },
      { player_id: 'unknown', session_id: 'shutout' },
    ],
    cards: [
      ...['green', 'yellow', 'red'].map((card_type) => ({
        player_id: 'me', game_id: 'shutout', card_type, created_at: '2026-05-01T12:00:00Z',
      })),
      { player_id: 'me', game_id: null, card_type: 'yellow', created_at: '2026-04-01T12:00:00Z' },
    ],
  })
  const html = render(RosterList, {
    players, myPlayerId: 'me', onSelect() {},
    statsMap: new Map(leaderboard.map((row) => [row.player.id, row])),
  })
  const cards = buttonsOf(html)
  const statsText = (card) => {
    const opening = openingWithClass(card, 'liga-roster-stats')
    for (const cls of ['text-xs', 'tabular-nums', 'flex-wrap', 'min-w-0']) {
      assert.ok(classesOf(opening).split(/\s+/).includes(cls), `stat row requires ${cls}`)
    }
    return textOf(card.match(/<div[^>]*class="[^"]*\bliga-roster-stats\b[^"]*"[^>]*>([\s\S]*?)<\/div>/)[1])
  }
  assert.equal(statsText(cards[0]), '3FG1PC1PS3A1CS1POTM2APP')
  assert.equal(statsText(cards.find((card) => textOf(card).includes('KEEPER ONLY'))), '1CS–POTM2APP')
  assert.equal(statsText(cards.find((card) => textOf(card).includes('ALPHA OUTFIELD'))), '–FG2PC1PS4A–POTM1APP')
  assert.equal(statsText(cards.find((card) => textOf(card).includes('UNKNOWN POSITION'))), '–POTM1APP')
  assert.doesNotMatch(cards.find((card) => textOf(card).includes('NO RECORDED STATS')), /liga-roster-stats/)
  for (const tag of html.match(/<span\b[^>]*class="[^"]*\bliga-roster-stat\b[^>]*>/g) ?? []) {
    assert.match(classesOf(tag), /\bwhitespace-nowrap\b/, 'a number never wraps away from its label')
  }
  assert.equal((html.match(/\bliga-roster-stat\b/g) ?? []).length, 18)
  assert.match(textOf(cards[0]), /▲1■2●1/, 'all card shapes retain their exact counts, including one')
  for (const color of ['green', 'yellow', 'red']) assert.match(cards[0], new RegExp(`text-${color}-400`))
  assert.doesNotMatch(html, /FG  PC  PS/, 'inline labels do not need a duplicate table-style header')
})

const SEASONS = [
  { id: 's2027', label: '2027', starts_on: '2027-01-01', ends_on: '2027-12-31', is_current: true, locked: false },
  { id: 's2026', label: '2026', starts_on: '2026-01-01', ends_on: '2026-12-31', is_current: false, locked: true },
]

test('season switcher: accessible dropdown (desktop) and 44px tabs (touch), locked seasons marked', () => {
  const switcherLoad = createTsLoader({ 'next/navigation': { useRouter: () => ({ refresh() {} }) } })
  const { SeasonMenu, SeasonTabs, LockedSeasonStrip } = switcherLoad('components/SeasonSwitcher.tsx')

  // Custom listbox (styled like the app) instead of a native <select>
  const menu = render(SeasonMenu, { seasons: SEASONS, selectedId: 's2026' })
  const trigger = buttonsOf(menu)[0]
  assert.match(trigger, /aria-haspopup="listbox"/)
  assert.match(trigger, /aria-expanded="false"/)
  assert.match(trigger, /aria-label="Season: MHL1 2026"/)
  assert.ok(classesOf(trigger).split(/\s+/).includes('min-h-[44px]'))
  assert.match(trigger, /<svg[^>]*aria-hidden/, 'lock icon beside an archived selection')
  assert.doesNotMatch(menu, /<select/)
  assert.match(menu, /<ul[^>]*role="listbox"[^>]*aria-label="Season"[^>]*hidden=""/, 'menu closed until opened')
  const optionTags = menu.match(/<li[^>]*role="option"[^>]*>[\s\S]*?<\/li>/g) ?? []
  assert.deepEqual(optionTags.map(textOf), ['MHL1 2027Current', 'MHL1 2026Archived'])
  assert.match(optionTags[1], /aria-selected="true"/)
  assert.match(optionTags[1], /M8 11V7a4 4 0 0 1 8 0v4/, 'archived season: lock icon')
  assert.equal(optionTags[1].replace(/<span class="sr-only">Archived<\/span>/, '').includes('Archived'), false, 'no visible "Archived" text, only for screen readers')
  assert.match(optionTags[1], /shadow-\[inset_3px_0_0_#5aa971\]/, 'selected season gets the green bar used across the app')
  assert.match(optionTags[0], /aria-selected="false"/)
  assert.match(menu, /bg-surface-card/, 'dark card menu, not the OS list')

  const tabs = render(SeasonTabs, { seasons: SEASONS, selectedId: 's2026' })
  assert.match(tabs, /role="group" aria-label="Season"/)
  const buttons = buttonsOf(tabs)
  assert.deepEqual(buttons.map(textOf), ['MHL1 2027', 'MHL1 2026'])
  assert.match(buttons[1], /aria-pressed="true"/)
  assert.match(buttons[0], /aria-pressed="false"/)
  for (const b of buttons) assert.ok(classesOf(b).split(/\s+/).includes('min-h-[44px]'))
  assert.match(textOf(tabs), /Read-only$/, 'locked season shows a Read-only tag')
  assert.doesNotMatch(textOf(render(SeasonTabs, { seasons: SEASONS, selectedId: 's2027' })), /Read-only/)

  assert.match(textOf(render(LockedSeasonStrip, { seasons: SEASONS, selectedId: 's2026' })), /MHL1 2026 is a past season — read-only\./)
  assert.equal(render(LockedSeasonStrip, { seasons: SEASONS, selectedId: 's2027' }), '')
})

test('season stats follow season_id; legacy cards follow their year; career spans every season', () => {
  const { computeSeason } = load('lib/stats.ts')
  const players = [player('p', 'Some Player')]
  const base = {
    players,
    games: [
      // Dated in 2026 but belongs to the 2027 season (e.g. a December pre-season game)
      { id: 'g27', game_date: '2026-12-20T12:00:00Z', result: 'win', goals_against: 1, season_id: 's2027' },
      { id: 'g26', game_date: '2026-05-01T12:00:00Z', result: 'loss', goals_against: 2, season_id: 's2026' },
    ],
    stats: [
      { player_id: 'p', game_id: 'g27', goals_fg: 2, goals_pc: 0, goals_ps: 0, assists: 0 },
      { player_id: 'p', game_id: 'g26', goals_fg: 1, goals_pc: 0, goals_ps: 0, assists: 1 },
    ],
    potm: [],
    attendance: [{ player_id: 'p', session_id: 'g27' }, { player_id: 'p', session_id: 'g26' }],
    cards: [{ player_id: 'p', game_id: null, card_type: 'green', created_at: '2026-07-01T00:00:00Z' }],
  }
  const s27 = computeSeason({ ...base, season: '2027', seasonId: 's2027' }).leaderboard[0]
  assert.equal(s27.goals, 2)
  assert.equal(s27.caps, 1)
  assert.equal(s27.cards.green, 0)
  const s26 = computeSeason({ ...base, season: '2026', seasonId: 's2026' }).leaderboard[0]
  assert.deepEqual([s26.goals, s26.assists, s26.caps, s26.cards.green], [1, 1, 1, 1])
  const career = computeSeason({ ...base, season: 'all' }).leaderboard[0]
  assert.deepEqual([career.goals, career.caps, career.cards.green], [3, 2, 1])
})

test('schedule roster is the season squad: everyone for a past season, active players for an open one', () => {
  const { seasonRoster } = createTsLoader({
    // react's `cache` ships in Next's bundled React only
    react: { ...React, cache: (fn) => fn },
    'next/headers': { cookies: () => ({ get: () => undefined }) },
    '@/lib/supabase/server': { createClient() { assert.fail('pure helper must not query') } },
  })('lib/season-server.ts')
  const squad = [
    player('b', 'Bravo', ['MID'], { jersey_number: 9 }),
    player('a', 'Alpha', ['GK'], { jersey_number: 1, is_active: false }),
  ]
  assert.deepEqual(seasonRoster(squad, true).map((p) => p.id), ['a', 'b'], 'locked: whole squad, by name')
  assert.deepEqual(seasonRoster(squad, false).map((p) => p.id), ['b'], 'open: active players only')
  assert.deepEqual(Object.keys(seasonRoster(squad, true)[0]).sort(), ['full_name', 'id', 'jersey_number', 'position', 'preferred_name'])
})

test('season summaries render quiet ranked divider rows with complete tied names and unchanged totals', () => {
  const { computeSeason, PotsCard, TopScorersCard } = load('components/SeasonStats.tsx')
  const players = [
    player('multi', 'Peh Yu Tay', ['FWD'], { preferred_name: 'Peh Yu' }),
    player('hyphen', 'Keaen-Seth Lim', ['MID'], { preferred_name: 'Keaen' }),
    player('fallback', 'Long Original Name', ['DEF'], { preferred_name: 'Extraordinarylongpreferredname' }),
  ]
  const { pots, topScorerGroups } = computeSeason({
    players, season: '2026', cards: [], attendance: [],
    games: [{ id: 'game', game_date: '2026-05-01T12:00:00Z', result: 'win', goals_against: 0 }],
    stats: [
      { player_id: 'multi', game_id: 'game', goals_fg: 2, goals_pc: 0, goals_ps: 0, assists: 1 },
      { player_id: 'hyphen', game_id: 'game', goals_fg: 1, goals_pc: 1, goals_ps: 0, assists: 0 },
      { player_id: 'fallback', game_id: 'game', goals_fg: 1, goals_pc: 0, goals_ps: 0, assists: 0 },
    ],
    potm: [
      { player_id: 'multi', game_id: 'game', place: 1 },
      { player_id: 'hyphen', game_id: 'game', place: 2 },
      { player_id: 'fallback', game_id: 'game', place: 3 },
    ],
  })
  const potsHtml = render(PotsCard, { pots })
  const scorersHtml = render(TopScorersCard, { groups: topScorerGroups })
  for (const html of [potsHtml, scorersHtml]) {
    assert.match(openingWithClass(html, 'liga-panel-heading'), /^<h2\b/)
    assert.match(classesOf(openingWithClass(html, 'liga-panel-row')), /\bborder-b\b/)
    assert.match(classesOf(openingWithClass(html, 'liga-panel-name')), /\bbreak-words\b/)
    assert.match(classesOf(openingWithClass(html, 'liga-panel-value')), /\btabular-nums\b/)
    assert.match(classesOf(openingWithClass(html, 'liga-panel-value')), /\btext-brand-light\b/)
    assert.match(classesOf(openingWithClass(html, 'liga-rank')), /\btabular-nums\b/)
    assert.doesNotMatch(html, /truncate|🥇|🥈|🥉/)
  }
  assert.equal(textOf(potsHtml), 'POTS Race1PEH YU3 pts2KEAEN2 pts3EXTRAORDINARYLONGPREFERREDNAME1 pts')
  assert.equal(textOf(scorersHtml), 'Top Scorers1PEH YU21KEAEN23EXTRAORDINARYLONGPREFERREDNAME1', 'one row per scorer; ties share a rank and the next rank skips')
  assert.equal(render(PotsCard, { pots: [] }), '')
  assert.equal(render(TopScorersCard, { groups: [] }), '')

  const rosterHtml = render(RosterList, { players, myPlayerId: null })
  for (const name of ['PEH YU TAY', 'KEAEN-SETH LIM', 'EXTRAORDINARYLONGPREFERREDNAME LONG ORIGINAL NAME']) {
    assert.ok(textOf(rosterHtml).includes(name), `roster keeps the complete original name: ${name}`)
  }
})

test('Squad headers use the Liga layout with wrapping admin controls while preserving filters and profile routes', () => {
  const routes = []
  const boundaryLoad = createTsLoader({
    'next/navigation': { useRouter: () => ({ push: (url) => routes.push(url) }) },
    './actions': {
      addPlayer() { assert.fail('Presentation rendering must not call a server action') },
      togglePlayerActive() { assert.fail('Presentation rendering must not call a server action') },
    },
  })
  const players = [
    player('me', 'Active Player', ['FWD'], { email: 'active@example.test', role: 'admin', auth_user_id: 'account' }),
    player('veteran', 'Former Player', ['GK'], { email: 'former@example.test', role: 'player', auth_user_id: null, is_active: false }),
    player('absent', 'No History', ['MID'], { email: 'absent@example.test', role: 'player', auth_user_id: null, is_active: false }),
  ]
  // `players` is the season's squad (season_players) as the page loads it
  const propsForSeason = (season) => ({
    season, players, myPlayerId: 'me', whitelist: [], cards: [], notInSquad: [],
    games: [{ id: 'game', opponent: 'Opponent', game_date: `${season.label}-05-01T12:00:00Z`, result: 'win', goals_for: 1, goals_against: 0, season_id: season.id }],
    stats: [{ player_id: 'me', game_id: 'game', goals_fg: 1, goals_pc: 0, goals_ps: 0, assists: 0 }],
    potm: [{ player_id: 'me', game_id: 'game', place: 1 }],
    attendance: [{ player_id: 'me', session_id: 'game' }, { player_id: 'veteran', session_id: 'game' }],
  })
  const [open, locked] = SEASONS
  for (const section of ['dashboard', 'admin']) {
    const Component = boundaryLoad(`app/${section}/team/SquadClient.tsx`).default
    const { html, tree } = captureRender(Component, propsForSeason(open))
    assert.match(classesOf(html), /\bliga-page\b/)
    assert.match(classesOf(openingWithClass(html, 'liga-page-header')), /\bflex-wrap\b/)
    assert.match(openingWithClass(html, 'liga-page-title'), /^<h1\b/)
    assert.match(html, />Squad<\/h1>/)
    const roster = findElement(tree, (node) => node.type === boundaryLoad('components/RosterList.tsx').default)
    assert.deepEqual(roster.props.players.map((p) => p.id), ['me'])
    roster.props.onSelect(players[0])
    assert.equal(routes.at(-1), `/${section}/team/me`)

    if (section === 'admin') {
      assert.match(classesOf(openingWithClass(html, 'liga-squad-actions')), /\bflex-wrap\b/)
      const add = buttonsOf(html).find((button) => textOf(button) === '+ Add Player')
      assert.match(classesOf(add), /\bliga-button-primary\b/)
      assert.match(classesOf(add), /\bbg-accent\b/)
      assert.ok(classesOf(add).split(/\s+/).includes('min-h-[44px]'))
      const toggle = openingWithClass(html, 'liga-inactive-toggle')
      assert.ok(classesOf(toggle).split(/\s+/).includes('min-h-[44px]'))
      assert.match(html, /Show inactive/)
      assert.match(html, /Top Scorers/)
      assert.doesNotMatch(html, /POTS Race/, 'POTS race is hidden on the admin Squad page')
    } else {
      assert.match(html, /<p class="[^"]*liga-meta[^"]*">MHL1 2027 · 1 players<\/p>/)
      assert.doesNotMatch(html, /Add Player|Show inactive|POTS Race/)
    }

    // A locked (past) season lists its whole squad and offers no edits, admins included
    const historical = captureRender(Component, propsForSeason(locked))
    const pastRoster = findElement(historical.tree, (node) => node.type === boundaryLoad('components/RosterList.tsx').default)
    assert.deepEqual(pastRoster.props.players.map((p) => p.id), ['me', 'veteran', 'absent'])
    assert.match(historical.html, /MHL1 2026 · 3 players/)
    assert.doesNotMatch(historical.html, /Add Player|Show inactive/)
  }

  // Keep mutations behind their original handlers; this presentation test never imports real actions.
  const adminSource = fs.readFileSync(path.join(root, 'app/admin/team/SquadClient.tsx'), 'utf8')
  for (const contract of [
    'onClick={openAdd}', 'setShowAddModal(true)', '<Modal onClose={() => { setShowAddModal(false); setError(null) }}>',
    'onSubmit={handleAddSubmit}', 'await addPlayer(data, joinSeason)', 'disabled={isPending}',
    'await togglePlayerActive(player.id, !player.is_active)',
    'onChange={(e) => setShowInactive(e.target.checked)}',
  ]) assert.ok(adminSource.includes(contract), `preserve admin interaction: ${contract}`)
})

test('desktop roster table: sortable stat columns, keeper rules, and the same row actions', () => {
  const { computeSeason } = load('lib/stats.ts')
  const { default: RosterTable } = load('components/RosterTable.tsx')
  const players = [
    player('me', 'Zulu Mine', ['FWD'], { jersey_number: 9 }),
    player('gk', 'Keeper Only', ['GK'], { jersey_number: 1 }),
    player('top', 'Alpha Scorer', ['FWD'], { jersey_number: 7 }),
  ]
  const { leaderboard } = computeSeason({
    players, season: '2026', attendance: [], cards: [], potm: [],
    games: [{ id: 'g', game_date: '2026-05-01T12:00:00Z', result: 'win', goals_against: 0 }],
    stats: [
      { player_id: 'top', game_id: 'g', goals_fg: 3, goals_pc: 0, goals_ps: 0, assists: 0 },
      { player_id: 'me', game_id: 'g', goals_fg: 1, goals_pc: 0, goals_ps: 0, assists: 2 },
    ],
  })
  const selected = []
  const html = render(RosterTable, {
    players, myPlayerId: 'me', onSelect: (p) => selected.push(p.id),
    statsMap: new Map(leaderboard.map((row) => [row.player.id, row])),
    accountMap: new Map([['me', 'active'], ['gk', 'invited'], ['top', 'none']]),
  })
  const headers = (html.match(/<th scope="col"[\s\S]*?<\/th>/g) ?? []).map(textOf)
  assert.deepEqual(headers.map((h) => h.replace(/[↑↓]/g, '').trim()), ['#', 'Player', 'Pos', 'FG', 'PC', 'PS', 'A', 'CS', 'POTM', 'APP', 'Cards', 'Acct'])
  assert.match(html, /aria-sort="ascending"[^>]*>\s*<button[^>]*title="Name"/, 'defaults to name, ascending')
  const rows = html.match(/<tr class="liga-roster-row[\s\S]*?<\/tr>/g) ?? []
  assert.deepEqual(rows.map((r) => textOf(r.match(/<th scope="row"[\s\S]*?<\/th>/)[0])), ['ZULU MINE (you)', 'ALPHA SCORER', 'KEEPER ONLY'], 'your row first, then A–Z')
  const cells = (r) => (r.match(/<td\b[^>]*>[\s\S]*?<\/td>|<td\b[^>]*\/>/g) ?? []).map(textOf)
  // # · Pos · FG PC PS A CS POTM APP (no attendance → no appearances or clean sheets) · Cards · Acct
  assert.deepEqual(cells(rows[0]).slice(0, 9), ['9', 'FWD', '1', '–', '–', '2', '', '–', '–'], 'outfielder: CS blank (n/a)')
  assert.deepEqual(cells(rows[2]).slice(0, 9), ['1', 'GK', '', '', '', '', '–', '–', '–'], 'keeper: goal columns blank, CS shown')
  assert.match(rows[0], /bg-brand\/15/, 'your row is highlighted')
  assert.match(rows[1], /<span class="sr-only">No account yet<\/span>/, 'account dot has a text alternative')
})

test('top scorers and assists: one row per player, ranked 1, 1, 3 …, shown until rank 5 is reached', () => {
  const { computeSeason, TopScorersCard, TopAssistsCard } = load('components/SeasonStats.tsx')
  const ranked = (Card, key, tallies) => {
    const players = tallies.map((_, i) => player(`p${i}`, `Player ${String.fromCharCode(65 + i)}`, ['FWD']))
    const season = computeSeason({
      players, season: '2026', cards: [], attendance: [], potm: [],
      games: [{ id: 'g', game_date: '2026-05-01T12:00:00Z', result: 'win', goals_against: 0 }],
      stats: tallies.map((n, i) => ({
        player_id: `p${i}`, game_id: 'g', goals_pc: 0, goals_ps: 0,
        goals_fg: key === 'goals' ? n : 0, assists: key === 'assists' ? n : 0,
      })),
    })
    const html = render(Card, { groups: key === 'goals' ? season.topScorerGroups : season.topAssistGroups })
    return (html.match(/<div class="liga-panel-row[\s\S]*?<\/div>/g) ?? []).map((row) =>
      (row.match(/<span[^>]*>([^<]*)<\/span>/g) ?? []).map(textOf).join(' '))
  }
  const ranks = (rows) => rows.map((r) => r.split(' ')[0])
  // This season's goals: a tie across 4th/5th means nobody is 5th, so the next group (6th) shows too
  assert.deepEqual(ranks(ranked(TopScorersCard, 'goals', [12, 12, 5, 4, 4, 3, 3, 2])), ['1', '1', '3', '4', '4', '6', '6'])
  assert.deepEqual(ranked(TopScorersCard, 'goals', [5, 5, 4])[0], '1 PLAYER 5', 'rank, name, tally')
  // Reaching exactly 5th stops there, keeping every player tied at 5th
  assert.deepEqual(ranks(ranked(TopScorersCard, 'goals', [9, 8, 7, 6, 5, 5, 4])), ['1', '2', '3', '4', '5', '5'])
  // A big tie up front still carries on until a rank of 5 or more is shown
  assert.deepEqual(ranks(ranked(TopScorersCard, 'goals', [3, 3, 3, 3, 3, 3, 2, 1])), ['1', '1', '1', '1', '1', '1', '7'])
  // Fewer scorers than that: list them all; zero tallies never appear
  assert.deepEqual(ranks(ranked(TopScorersCard, 'goals', [2, 0, 1])), ['1', '2'])
  // Assists use the same rule (this season: 5, 4, 4, 4, 3, 3, 2 → 1, 2, 2, 2, 5, 5)
  const assists = ranked(TopAssistsCard, 'assists', [5, 4, 4, 4, 3, 3, 2])
  assert.deepEqual(ranks(assists), ['1', '2', '2', '2', '5', '5'])
  assert.equal(render(TopAssistsCard, { groups: [] }), '', 'no assists yet: no card')
  assert.equal(assists[0], '1 PLAYER 5')
})

test('schedule master–detail: inline details panel on desktop, modal on touch layouts', () => {
  const { ReadEditModal } = load('components/ReadEditModal.tsx')
  const props = { title: 'vs Opponent', isOpen: true, onClose() {}, editMode: false, onEnterEdit() {}, onSave() {}, onDiscard() {}, isPending: false, editInHeader: true }
  const inlineAdmin = render(ReadEditModal, { ...props, isAdmin: true, inline: true, children: React.createElement('p', null, 'Details') })
  assert.match(inlineAdmin, /^<section aria-label="vs Opponent" class="liga-detail-panel card p-5">/, 'renders in place, labelled by the event')
  assert.match(inlineAdmin, />Edit</, 'admin can still edit in the panel')
  assert.doesNotMatch(inlineAdmin, />Close</, 'nothing to close in a panel')
  assert.doesNotMatch(render(ReadEditModal, { ...props, isAdmin: false, inline: true, children: null }), />Close</)

  const selection = fs.readFileSync(path.join(root, 'lib/useEventSelection.ts'), 'utf8')
  assert.match(selection, /picked \?\? \(isDesktop \? upcoming\[0\] \?\? past\[0\] \?\? null : null\)/, 'desktop defaults to the next event, else the latest')
  for (const area of ['admin', 'dashboard']) {
    const src = fs.readFileSync(path.join(root, `app/${area}/schedule/ScheduleClient.tsx`), 'utf8')
    assert.match(src, /useEventSelection\(upcoming, past\)/)
    assert.match(src, /key=\{eventKey\(selectedItem\)\}\s+inline=\{isDesktop\}/, 'panel remounts per event so local state never leaks across events')
    assert.match(src, /\{isDesktop && detail\}/)
    assert.match(src, /\{!isDesktop && detail\}/)
    assert.match(src, /lg:grid lg:grid-cols-\[minmax\(0,1fr\)_26rem\]/)
    assert.match(src, /if \(!isDesktop\) setSelectedItem\(null\)/, 'saving keeps the desktop panel on the edited event')
    assert.match(src, /data-selected=\{isSelected\(item\) \|\| undefined\}/)
  }
})

test('season squad membership: admins add existing players and remove players without a season record', () => {
  const calls = []
  const adminActions = {
    addPlayersToSeason: async (ids) => calls.push(['add', ids]),
    removePlayerFromSeason: async (id) => calls.push(['remove', id]),
    togglePlayerActive: async (id, active) => calls.push(['active', id, active]),
  }
  const boundaryLoad = createTsLoader({
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {}, back() {} }), usePathname: () => '/admin/team/p' },
    './actions': adminActions,
    '@/app/admin/team/actions': adminActions,
    '@/app/admin/team/inviteActions': { generateSetupLink: async () => assert.fail('not called') },
  })

  // + Existing Player picker lists who isn't in the squad, inactive ones marked
  const { default: ExistingPlayerPicker } = boundaryLoad('app/admin/team/ExistingPlayerPicker.tsx')
  const picker = render(ExistingPlayerPicker, {
    seasonLabel: '2027',
    onClose() {},
    players: [
      { id: 'r', full_name: 'Returning Player', preferred_name: 'RET', jersey_number: 7, is_active: false },
    ],
  })
  assert.match(textOf(picker), /RETReturning Player · #7 · inactive/)
  assert.match(picker, /type="checkbox"/)
  assert.match(textOf(picker), /Add to 2027/)
  assert.match(textOf(render(ExistingPlayerPicker, { seasonLabel: '2027', onClose() {}, players: [] })), /Everyone is already in this season/)

  // Profile squad panel: the right single action per state
  const { PlayerProfilePage } = boundaryLoad('components/PlayerProfilePage.tsx')
  const profile = (squadStatus) =>
    textOf(render(PlayerProfilePage, {
      player: { id: 'p', full_name: 'Some Player', preferred_name: null, jersey_number: 4, position: ['MID'], is_active: true },
      seasonRow: undefined, careerRow: undefined, seasonLabel: 'MHL1 2027', squadStatus,
    }))
  assert.match(profile({ seasonLabel: '2027', inSquad: false, hasRecord: false, isActive: true }), /MHL1 2027 squadNot in squadAdd to 2027/)
  assert.match(profile({ seasonLabel: '2027', inSquad: true, hasRecord: false, isActive: true }), /In squadRemove from 2027/)
  const withRecord = profile({ seasonLabel: '2027', inSquad: true, hasRecord: true, isActive: true })
  assert.match(withRecord, /Mark inactive/)
  assert.doesNotMatch(withRecord, /Remove from/, 'a player with a season record is never offered removal')
  assert.doesNotMatch(profile(undefined), /squad(Not|In) /i, 'no panel without squadStatus (player view / archived season)')
  assert.deepEqual(calls, [], 'rendering never calls a server action')
})

test('squad membership is admin-only and open-season-only', () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
  const actions = read('app/admin/team/actions.ts')
  for (const fn of ['addPlayer', 'updatePlayer', 'importPlayers', 'togglePlayerActive', 'addPlayersToSeason', 'removePlayerFromSeason']) {
    assert.match(actions, new RegExp(String.raw`export async function ${fn}\([^)]*\) \{\s+const supabase = createClient\(\)\s+await requireAdmin\(supabase\)`), `${fn} checks is_admin() first`)
  }
  assert.match(actions, /export async function removePlayerFromSeason[\s\S]*?if \(await hasSeasonRecord\(season\.id, playerId\)\)[\s\S]*?throw/, 'removal refused when the player has a season record')
  const view = read('components/PlayerProfileView.tsx')
  assert.match(view, /if \(includeAccount && !season\.locked\) \{\s*squadStatus = /, 'squad panel only on the admin route, open seasons only')
  for (const route of ['app/dashboard/team/[playerId]/page.tsx', 'app/dashboard/team/@modal/(.)[playerId]/page.tsx']) {
    assert.doesNotMatch(read(route), /includeAccount/, `${route} (player view) never gets admin panels`)
  }
  assert.doesNotMatch(read('app/dashboard/team/SquadClient.tsx'), /Existing Player|ExistingPlayerPicker/)
  assert.match(read('app/admin/team/SquadClient.tsx'), /\{!season\.locked && \([\s\S]*?\+ Existing Player/, 'picker button only for open seasons')
  assert.match(read('supabase/migrations/011_seasons.sql'), /"Admins manage season_players" on public\.season_players\s+for all using \(is_admin\(\)\) with check \(is_admin\(\)\)/, 'RLS: only admins write season_players')
})

test('pending players: added without an email, shown as pending, invited only once an email is saved', () => {
  const { accountStatusOf, ACCOUNT_DOT } = load('components/RosterList.tsx')
  assert.equal(accountStatusOf({ email: null, auth_user_id: null }, null), 'pending')
  assert.equal(accountStatusOf({ email: 'a@b.co', auth_user_id: null }, null), 'none')
  assert.equal(accountStatusOf({ email: 'a@b.co', auth_user_id: null }, '2026-10-01'), 'invited')
  assert.equal(accountStatusOf({ email: 'a@b.co', auth_user_id: 'u' }, null), 'active')
  assert.match(ACCOUNT_DOT.pending.title, /Pending/)

  const stubs = {
    addPlayersToSeason: async () => {}, removePlayerFromSeason: async () => {}, togglePlayerActive: async () => {},
    setPlayerEmail: async () => assert.fail('render must not save'),
  }
  const boundaryLoad = createTsLoader({
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {}, back() {} }), usePathname: () => '/admin/team/p' },
    '@/app/admin/team/actions': stubs,
    './actions': { ...stubs, updatePlayer: async () => assert.fail('render must not save') },
    '@/app/admin/team/inviteActions': { generateSetupLink: async () => assert.fail('not called') },
  })
  const { PlayerProfilePage } = boundaryLoad('components/PlayerProfilePage.tsx')
  const profile = (accountStatus) => render(PlayerProfilePage, {
    player: { id: 'p', full_name: 'Some Player', preferred_name: null, jersey_number: null, position: null, is_active: true },
    seasonRow: undefined, careerRow: undefined, seasonLabel: 'MHL1 2027', accountStatus,
  })
  const pending = profile('pending')
  assert.match(textOf(pending), /Pending — no email yet/)
  assert.match(pending, /<input[^>]*type="email"[^>]*aria-label="Player email"|<input[^>]*aria-label="Player email"[^>]*type="email"/)
  assert.match(textOf(pending), /Save email/)
  assert.doesNotMatch(textOf(pending), /Invite link/, 'no invite until there is an email')
  assert.match(textOf(profile('none')), /Invite link/)
  assert.doesNotMatch(profile('none'), /aria-label="Player email"/)

  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
  const squad = read('app/admin/team/SquadClient.tsx')
  assert.doesNotMatch(squad, /name="email" type="email" required/, 'email is optional on Add Player')
  assert.match(squad, /checked=\{joinSeason\}/, 'Add Player can skip the season (past players)')
  const actions = read('app/admin/team/actions.ts')
  assert.match(actions, /is_active: joinSeason/, 'players added outside the season are inactive (no auto-join)')
  assert.match(actions, /export async function setPlayerEmail[\s\S]*?requireAdmin\(supabase\)[\s\S]*?if \(player\.auth_user_id\) throw/, 'only admins; never rewrites an existing login')
  assert.match(read('app/admin/team/inviteActions.ts'), /if \(!player\.email\) throw/)
  const migration = read('supabase/migrations/012_pending_players.sql')
  assert.match(migration, /alter column email drop not null/)
  assert.match(migration, /check \(email is null or btrim\(email\) <> ''\)/)
  assert.match(migration, /if not new\.is_active then\s+return new;/)
})

test('admin player edit: prefilled form, season-aware jersey, locked email/role where they must not change', () => {
  const saved = []
  const boundaryLoad = createTsLoader({
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {}, back() {} }), usePathname: () => '/admin/team/p' },
    './actions': { updatePlayer: async (...args) => saved.push(args) },
  })
  const { default: PlayerEditModal } = boundaryLoad('app/admin/team/PlayerEditModal.tsx')
  const player = {
    id: 'p', full_name: 'SOME PLAYER', preferred_name: 'SOMEY', email: 'some@x.co', role: 'admin',
    position: ['MID', 'GK'], date_of_birth: '1999-04-05', joined_year: 2016, is_active: true, jersey_number: 22,
  }
  const html = (context) => render(PlayerEditModal, { player, context, onClose() {} })
  const open = html({ seasonLabel: '2027', jerseyMode: 'season', hasAccount: false, isSelf: false })
  assert.match(open, /value="SOME PLAYER"/)
  assert.match(open, /value="1999-04-05"/)
  assert.match(textOf(open), /Jersey # \(MHL1 2027\)/)
  assert.match(open, /aria-pressed="true"[^>]*>MID</)
  assert.match(open, /aria-pressed="true"[^>]*>GK</)
  assert.match(open, /aria-pressed="false"[^>]*>FWD</)
  assert.doesNotMatch(open, /<input[^>]*name="email"[^>]*disabled=""/)

  const self = html({ seasonLabel: '2026', jerseyMode: 'archived', hasAccount: true, isSelf: true })
  assert.match(self, /<input[^>]*name="email"[^>]*disabled=""/, 'login email is fixed once they have an account')
  assert.match(self, /<select[^>]*name="role"[^>]*disabled=""/, 'own role is fixed')
  assert.match(self, /<input[^>]*name="jersey_number"[^>]*disabled=""/, 'archived season number is read-only')
  assert.match(textOf(self), /Archived season — read-only/)
  assert.match(textOf(html({ seasonLabel: '2027', jerseyMode: 'default', hasAccount: false, isSelf: false })), /Jersey # \(default for new seasons\)/)
  assert.deepEqual(saved, [], 'rendering never saves')

  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
  const actions = read('app/admin/team/actions.ts')
  assert.match(actions, /export async function updatePlayer\(id: string, data: PlayerDetailsInput\) \{\s+const supabase = createClient\(\)\s+await requireAdmin\(supabase\)/)
  assert.match(actions, /if \(current\.auth_user_id && email !== current\.email\)\s*\{\s*throw/, 'server refuses login-email changes')
  assert.match(actions, /current\.auth_user_id === user\?\.id && data\.role !== current\.role\)\s*\{\s*throw/, 'server refuses self role change')
  assert.match(actions, /if \(entry && !season\.locked\)/, 'season jersey only written for open seasons')
  const view = read('components/PlayerProfileView.tsx')
  assert.match(view, /let editContext: EditContext \| undefined\s+if \(includeAccount\) \{/, 'edit only on the admin route')
  assert.doesNotMatch(read('supabase/migrations/013_universal_positions.sql'), /insert into season_players \(season_id, player_id, jersey_number, position\)/)
})

test('All time: first in the switcher, view-only, never labelled Archived; squad shows career totals', () => {
  const { ALL_TIME, seasonTitle } = load('lib/season.ts')
  assert.equal(seasonTitle(ALL_TIME), 'All time')
  assert.equal(seasonTitle(SEASONS[0]), 'MHL1 2027')
  assert.equal(ALL_TIME.locked, true, 'view-only: every write path refuses it')

  const switcherLoad = createTsLoader({ 'next/navigation': { useRouter: () => ({ refresh() {} }) } })
  const { SeasonMenu, SeasonTabs, LockedSeasonStrip } = switcherLoad('components/SeasonSwitcher.tsx')
  const nav = { seasons: [ALL_TIME, ...SEASONS], selectedId: 'all' }

  const menu = render(SeasonMenu, nav)
  const options = (menu.match(/<li[^>]*role="option"[^>]*>[\s\S]*?<\/li>/g) ?? [])
  assert.deepEqual(options.map(textOf), ['All time', 'MHL1 2027Current', 'MHL1 2026Archived'], 'All time on top; only real past seasons say Archived')
  assert.match(options[0], /border-b border-surface-border/, 'divider under All time')
  assert.doesNotMatch(buttonsOf(menu)[0], /M8 11V7a4 4 0 0 1 8 0v4/, 'no lock icon on the trigger for All time')

  const tabs = render(SeasonTabs, nav)
  const buttons = buttonsOf(tabs)
  assert.deepEqual(buttons.map(textOf), ['All time', 'MHL1 2027', 'MHL1 2026'])
  assert.doesNotMatch(buttons[0], /<svg/, 'All time tab has no lock')
  assert.match(tabs, /All time<\/button><span aria-hidden="true" class="[^"]*w-px/, 'divider between All time and the seasons')
  assert.match(textOf(tabs), /View only$/)
  assert.match(textOf(render(LockedSeasonStrip, nav)), /All time — every season combined\. View only; pick a season to make changes\./)

  const server = fs.readFileSync(path.join(root, 'lib/season-server.ts'), 'utf8')
  assert.match(server, /seasons: \[ALL_TIME, \.\.\.seasons\]/, 'switcher lists All time first')
  assert.match(server, /if \(wanted === ALL_TIME\.label && seasons\.length > 0\) return ALL_TIME/)

  // Squad under All time: every game counts, read-only header
  const boundaryLoad = createTsLoader({
    'next/navigation': { useRouter: () => ({ push() {} }) },
  })
  const SquadClient = boundaryLoad('app/dashboard/team/SquadClient.tsx').default
  const players = [player('p', 'Some Player')]
  const { html } = captureRender(SquadClient, {
    season: ALL_TIME, players, myPlayerId: null, potm: [], attendance: [], cards: [],
    games: [
      { id: 'g26', game_date: '2026-05-01T12:00:00Z', result: 'win', goals_against: 0, season_id: 's2026' },
      { id: 'g27', game_date: '2027-05-01T12:00:00Z', result: 'win', goals_against: 0, season_id: 's2027' },
    ],
    stats: [
      { player_id: 'p', game_id: 'g26', goals_fg: 2, goals_pc: 0, goals_ps: 0, assists: 0 },
      { player_id: 'p', game_id: 'g27', goals_fg: 1, goals_pc: 0, goals_ps: 0, assists: 0 },
    ],
  })
  assert.match(html, /All time · 1 players/)
  assert.match(textOf(html), /Top Scorers1SOME3/, 'career goals across both seasons')
})

test('season phase is derived from fixtures and today (Singapore days)', () => {
  const { seasonPhase, nextSeasonLabel, PHASE_LABEL } = load('lib/season.ts')
  const at = (iso) => new Date(iso)
  const fixtures = ['2027-04-12T02:00:00Z', '2027-05-10T02:00:00Z', '2027-06-27T07:00:00Z']
  assert.equal(seasonPhase([], at('2027-05-01T00:00:00Z')), 'pre-season', 'no fixtures yet')
  assert.equal(seasonPhase(fixtures, at('2027-04-11T10:00:00Z')), 'pre-season', 'before the first fixture day')
  assert.equal(seasonPhase(fixtures, at('2027-04-12T00:30:00Z')), 'season', 'first fixture day counts as season')
  assert.equal(seasonPhase(fixtures, at('2027-05-20T00:00:00Z')), 'season')
  assert.equal(seasonPhase(fixtures, at('2027-06-27T12:00:00Z')), 'season', 'last fixture day (19:00 SGT) still season')
  assert.equal(seasonPhase(fixtures, at('2027-06-27T16:30:00Z')), 'post-season', '00:30 SGT the day after the last fixture')
  assert.equal(seasonPhase([...fixtures].reverse(), at('2027-04-11T10:00:00Z')), 'pre-season', 'order of fixtures does not matter')
  assert.equal(PHASE_LABEL['post-season'], 'Post-season')
  assert.equal(nextSeasonLabel('2027'), '2028')
  assert.equal(nextSeasonLabel('Spring league'), null)
})

test('close season: admin-only Danger zone with three confirmations', () => {
  const boundaryLoad = createTsLoader({
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    './seasonActions': { closeSeason: async () => assert.fail('render must not close a season') },
  })
  const { default: CloseSeasonPanel } = boundaryLoad('app/admin/dashboard/CloseSeasonPanel.tsx')
  const summary = {
    label: '2027', nextLabel: '2028', phase: 'season', fixtures: 3,
    firstFixture: '2027-04-12T02:00:00Z', lastFixture: '2027-06-27T07:00:00Z', upcomingEvents: 2, carryOver: 28,
  }
  const html = render(CloseSeasonPanel, { summary })
  assert.match(textOf(html), /Danger zone/i)
  assert.match(textOf(html), /Close MHL1 2027/)
  assert.match(textOf(html), /Season · 3 fixtures/)
  assert.doesNotMatch(html, /role="dialog"/, 'nothing opens until the button is pressed')
  assert.match(render(CloseSeasonPanel, { summary: { ...summary, nextLabel: null } }), /<button[^>]*disabled=""[^>]*>Close season/)

  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
  const panel = read('app/admin/dashboard/CloseSeasonPanel.tsx')
  assert.match(panel, /onClick=\{\(\) => setStep\('confirm'\)\}/, '1. the Close season button opens the confirmation')
  assert.match(panel, /onClick=\{\(\) => setStep\('type'\)\}/, '2. "Yes, close" moves to the typing step')
  assert.match(panel, /const CONFIRM_WORD = 'CLOSE'/)
  assert.match(panel, /disabled=\{typed !== CONFIRM_WORD \|\| isPending\}/, '3. final button only once CLOSE is typed exactly')
  const action = read('app/admin/dashboard/seasonActions.ts')
  assert.match(action, /if \(confirmation !== 'CLOSE'\) throw/, 'server re-checks the typed word')
  assert.match(action, /rpc\('is_admin'\)[\s\S]*rpc\('close_current_season'\)/)
  const home = read('components/HomeView.tsx')
  assert.match(home, /basePath === '\/admin' && season\.is_current && !season\.locked \? await getCloseSeasonSummary\(season\)/, 'admin Home, current season only')
  const migration = read('supabase/migrations/014_close_season.sql')
  assert.match(migration, /if not public\.is_admin\(\) then\s+raise exception/)
  assert.match(migration, /update seasons set is_current = false, locked = true where id = cur\.id/)
  assert.match(migration, /revoke execute on function public\.close_current_season\(\) from public, anon;/)
})
