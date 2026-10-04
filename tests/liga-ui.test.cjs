const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const css = () => postcss.parse(read('app/globals.css'))
function declarations(selector) {
  const result = {}
  css().walkRules(selector, (rule) => {
    rule.walkDecls((decl) => { result[decl.prop] = decl.value })
  })
  return result
}

test('authenticated app typography, controls and shell are scoped to app routes', () => {
  assert.match(read('components/AppShell.tsx'), /isLigaAppPath\(pathname\)/)
  for (const file of [
    'app/dashboard/page.tsx',
    'app/dashboard/polls/PollsClient.tsx',
    'app/admin/polls/PollsClient.tsx',
    'app/admin/profile/page.tsx',
    'components/admin/DashboardView.tsx',
  ]) assert.match(read(file), /liga-page/, `${file} exposes the shared page frame`)
  assert.match(read('app/dashboard/schedule/ScheduleClient.tsx'), /liga-event-list/)
  assert.match(read('app/admin/schedule/ScheduleClient.tsx'), /liga-event-list/)
  assert.match(read('components/EventRow.tsx'), /liga-event-row/)
  assert.equal(declarations('.liga-ui')['font-family'], 'var(--font-inter), ui-sans-serif, system-ui, sans-serif')
  assert.equal(declarations('.liga-ui .liga-event-card.card')['background-color'], 'transparent')
  assert.equal(declarations('.liga-ui .liga-event-card.card')['border-bottom'], '1px solid #323238')
  assert.equal(declarations('.liga-ui .liga-event-actions .liga-button')['border'], '0')
  assert.equal(declarations('.liga-ui .liga-event-actions .liga-button')['flex'], '0 1 6rem')
  assert.equal(declarations('.liga-ui .liga-event-actions .liga-event-action-quiet')['background-color'], 'transparent')
  assert.equal(declarations('.liga-ui .liga-meta')['font-family'], 'var(--font-liga-mono), ui-monospace, monospace')
  assert.equal(declarations('.liga-ui .liga-button')['min-height'], '44px')
  assert.equal(declarations('.liga-ui .liga-page')['margin-inline'], 'auto')
  assert.deepEqual(declarations('.liga-meta'), {}, 'metadata styles stay scoped to the app shell')
  assert.deepEqual(declarations('.liga-button'), {}, 'button styles stay scoped to the app shell')
  assert.deepEqual(declarations('.liga-page'), {}, 'page framing stays scoped to the app shell')
  assert.equal(declarations('.liga-ui .menu-dock')['backdrop-filter'], 'none')
  assert.match(read('components/BottomNav.tsx'), /safe-area-inset-bottom\)\+24px/)
  const ts = require('typescript')
  const compiled = ts.transpileModule(read('lib/liga-ui.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  new Function('exports', 'module', compiled)(module.exports, module)
  const { isLigaAppPath } = module.exports
  for (const p of [
    '/dashboard', '/dashboard/team', '/dashboard/team/123', '/dashboard/schedule', '/dashboard/polls',
    '/admin', '/admin/dashboard', '/admin/team', '/admin/schedule', '/admin/polls', '/admin/profile', '/admin/team/123',
  ]) assert.equal(isLigaAppPath(p), true)
  for (const p of ['/', '/login', '/auth/confirm', '/auth/set-password', null]) assert.equal(isLigaAppPath(p), false)
})

test('shared app pages expose consistent list, surface and modal hooks', () => {
  for (const file of [
    'components/PollResults.tsx',
    'components/PotmPolls.tsx',
    'components/ReadEditModal.tsx',
    'components/MatchResultModal.tsx',
    'components/TeamListModal.tsx',
    'components/PlayerProfilePage.tsx',
    'components/SignOutButton.tsx',
  ]) assert.match(read(file), /liga-/, `${file} exposes a shared Liga hook`)
  assert.equal(declarations('.liga-ui .liga-hero')['border-radius'], '8px')
  assert.equal(declarations('.liga-ui .liga-link-row.card')['background-color'], 'transparent')
  assert.equal(declarations('.liga-ui .liga-panel.card')['background-color'], 'transparent')
  assert.equal(declarations('.liga-ui .liga-poll-card.card')['border-bottom'], '1px solid #323238')
  assert.equal(declarations('.liga-ui .liga-modal-panel')['border-radius'], '8px')
  assert.equal(declarations('.liga-ui input.liga-field')['height'], '42px')
})

test('app UI caps at a single 1200px width shared by header and page content', () => {
  assert.equal(declarations(':root')['--app-max-width'], '1200px')
  const container = declarations('.app-container')
  assert.equal(container['max-width'], 'var(--app-max-width)')
  assert.equal(container['margin-inline'], 'auto')
  assert.match(read('tailwind.config.ts'), /app: 'var\(--app-max-width\)'/)
  const shell = read('components/AppShell.tsx')
  assert.equal((shell.match(/className="app-container[ "]/g) ?? []).length, 2, 'header row and page content share the container')
  assert.equal(declarations('.liga-ui .liga-page')['max-width'], undefined, 'pages defer to the app container width')
})

test('desktop (lg+) swaps the floating bottom nav for labelled header links', () => {
  const shell = read('components/AppShell.tsx')
  assert.match(shell, /<TopNav items=\{nav\} \/>/, 'header renders the same nav items')
  assert.match(shell, /pb-28 lg:pb-12/, 'no bottom-nav clearance on desktop')
  const top = read('components/TopNav.tsx')
  assert.match(top, /aria-label="Primary"/)
  assert.match(top, /hidden items-center gap-1 lg:flex/, 'header nav is desktop-only')
  assert.match(top, /\{item\.label\}/, 'every desktop link shows its label')
  assert.match(top, /aria-current=\{active \? 'page' : undefined\}/)
  assert.match(read('components/BottomNav.tsx'), /lg:hidden"/, 'bottom nav is touch-only')
  assert.match(read('components/admin/DashboardView.tsx'), /<div className="lg:hidden">\s*<h2 className="liga-section-title mt-7">Quick links/, 'quick links are touch-only')
})

test('Liga surfaces are opt-in and preserve the existing palette', () => {
  const panel = declarations('.liga-ui .card')
  assert.equal(panel['border-radius'], '8px')
  assert.equal(panel['background-color'], '#1e1e21')
  assert.equal(declarations('.card')['border-radius'], '1.25rem', 'non-pilot cards stay unchanged')
  const theme = read('tailwind.config.ts')
  for (const colour of ['#131315', '#1e1e21', '#26262a', '#323238', '#2e6b3e', '#245331', '#5aa971', '#E0C070', '#C0A050']) {
    assert.ok(theme.includes(colour), `preserve ${colour}`)
  }
})
