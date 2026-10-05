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

test('season selection has an accessible name and a 44px hit target without changing its values or callback', () => {
  const { SeasonSelect } = load('components/SeasonStats.tsx')
  const changes = []
  const props = { seasons: ['2026', '2025'], value: '2025', onChange: (value) => changes.push(value) }
  const html = render(SeasonSelect, props)
  assert.match(html, /<select[^>]*aria-label="Season"/)
  assert.match(classesOf(html), /\bliga-season-select\b/)
  assert.ok(classesOf(html).split(/\s+/).includes('min-h-[44px]'))
  assert.match(html, /<option value="2026">MHL1 2026<\/option>/)
  assert.match(html, /<option value="2025" selected="">MHL1 2025<\/option>/)
  SeasonSelect(props).props.onChange({ target: { value: '2026' } })
  assert.deepEqual(changes, ['2026'])
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
  const propsForYear = (year) => ({
    players, myPlayerId: 'me', whitelist: [], cards: [],
    games: [{ id: 'game', opponent: 'Opponent', game_date: `${year}-05-01T12:00:00Z`, result: 'win', goals_for: 1, goals_against: 0 }],
    stats: [{ player_id: 'me', game_id: 'game', goals_fg: 1, goals_pc: 0, goals_ps: 0, assists: 0 }],
    potm: [{ player_id: 'me', game_id: 'game', place: 1 }],
    attendance: [{ player_id: 'me', session_id: 'game' }, { player_id: 'veteran', session_id: 'game' }],
  })
  const year = new Date().getFullYear()
  for (const section of ['dashboard', 'admin']) {
    const Component = boundaryLoad(`app/${section}/team/SquadClient.tsx`).default
    const { html, tree } = captureRender(Component, propsForYear(year))
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
      assert.match(html, /<p class="[^"]*liga-meta[^"]*">1 players<\/p>/)
      assert.doesNotMatch(html, /Add Player|Show inactive|POTS Race/)
      const historical = captureRender(Component, propsForYear(year - 1))
      const pastRoster = findElement(historical.tree, (node) => node.type === boundaryLoad('components/RosterList.tsx').default)
      assert.deepEqual(pastRoster.props.players.map((p) => p.id), ['me', 'veteran'])
    }
  }

  // Keep mutations behind their original handlers; this presentation test never imports real actions.
  const adminSource = fs.readFileSync(path.join(root, 'app/admin/team/SquadClient.tsx'), 'utf8')
  for (const contract of [
    'onClick={openAdd}', 'setShowAddModal(true)', '<Modal onClose={() => { setShowAddModal(false); setError(null) }}>',
    'onSubmit={handleAddSubmit}', 'await addPlayer(data)', 'disabled={isPending}',
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

test('top scorers list each player on their own row down to rank 5, ties included', () => {
  const { computeSeason, TopScorersCard } = load('components/SeasonStats.tsx')
  const scorers = (goals) => {
    const players = goals.map((_, i) => player(`p${i}`, `Player ${String.fromCharCode(65 + i)}`, ['FWD']))
    const { topScorerGroups } = computeSeason({
      players, season: '2026', cards: [], attendance: [], potm: [],
      games: [{ id: 'g', game_date: '2026-05-01T12:00:00Z', result: 'win', goals_against: 0 }],
      stats: goals.map((g, i) => ({ player_id: `p${i}`, game_id: 'g', goals_fg: g, goals_pc: 0, goals_ps: 0, assists: 0 })),
    })
    const html = render(TopScorersCard, { groups: topScorerGroups })
    return (html.match(/<div class="liga-panel-row[\s\S]*?<\/div>/g) ?? []).map((row) =>
      (row.match(/<span[^>]*>([^<]*)<\/span>/g) ?? []).map(textOf).join(' '))
  }
  // 1, 1, 3, 4, 4, 4 — the next tally would rank 7th, so it's cut
  assert.deepEqual(scorers([5, 5, 4, 3, 3, 3, 2]), ['1 PLAYER 5', '1 PLAYER 5', '3 PLAYER 4', '4 PLAYER 3', '4 PLAYER 3', '4 PLAYER 3'])
  // A tie at rank 5 keeps every tied player
  assert.deepEqual(scorers([9, 8, 7, 6, 5, 5, 4]).map((r) => r.split(' ')[0]), ['1', '2', '3', '4', '5', '5'])
  // Fewer than five scorers: list them all
  assert.deepEqual(scorers([2, 0, 1]).map((r) => r.split(' ')[0]), ['1', '2'])
})
