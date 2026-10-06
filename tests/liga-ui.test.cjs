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
    'app/dashboard/polls/PollsClient.tsx',
    'app/admin/polls/PollsClient.tsx',
    'app/admin/profile/page.tsx',
    'components/HomeView.tsx',
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
})

test('desktop (lg+) lifts small metadata to 12px and swaps greys that fail 4.5:1', () => {
  assert.equal(declarations(':root')['--text-tertiary'], '#8a94a6')
  const desktop = {}
  const layers = {}
  css().walkAtRules('media', (media) => {
    if (media.params !== '(min-width: 1024px)') return
    media.walkRules((rule) => {
      const into = media.parent.type === 'atrule' && media.parent.name === 'layer' ? layers : desktop
      rule.walkDecls((decl) => { for (const sel of rule.selectors) into[sel] = { ...into[sel], [decl.prop]: decl.value } })
    })
  })
  for (const sel of ['.liga-ui .liga-meta', '.liga-ui .liga-section-title', '.liga-ui .liga-event-meta', '.liga-ui .liga-roster-position', '.liga-ui .liga-roster-card .liga-meta']) {
    assert.equal(desktop[sel]?.['font-size'], '0.75rem', `${sel} is 12px on desktop`)
  }
  // Utility overrides live in the utilities layer so hover:/focus: variants still win
  assert.equal(layers['.liga-ui .text-\\[10px\\]']?.['font-size'], '0.75rem')
  assert.equal(layers['.liga-ui .text-\\[11px\\]']?.['font-size'], '0.75rem')
  assert.equal(layers['.liga-ui .text-slate-500']?.color, 'var(--text-tertiary)')
  assert.equal(layers['.liga-ui .text-slate-600']?.color, 'var(--text-tertiary)')
  for (const cls of ['.text-slate-400', '.text-slate-500', '.text-white\\/50', '.text-white\\/70', '.liga-roster-position']) {
    assert.equal(layers[`.liga-ui .bg-accent ${cls}`]?.color, 'rgba(255, 255, 255, 0.85)', `${cls} stays readable on green surfaces`)
  }
  assert.equal(declarations('.liga-ui .liga-meta')['font-family'], 'var(--font-liga-mono), ui-monospace, monospace', 'touch layouts keep the mono metadata')
})

test('every modal uses the shared dialog shell (Esc, focus, labelling, desktop width)', () => {
  const modal = read('components/Modal.tsx')
  assert.match(modal, /role="dialog"/)
  assert.match(modal, /aria-modal="true"/)
  assert.match(modal, /setAttribute\('aria-labelledby', heading\.id\)/)
  assert.match(modal, /e\.key === 'Escape'/)
  assert.match(modal, /e\.key !== 'Tab'/, 'Tab is kept inside the open dialog')
  assert.match(modal, /opener\?\.isConnected\) opener\.focus/, 'focus returns to the opener on close')
  assert.match(modal, /sm: 'sm:max-w-sm lg:max-w-md'/)
  assert.match(modal, /md: 'sm:max-w-md lg:max-w-lg'/)
  assert.match(modal, /useModalScrollLock\(\)/)
  for (const file of [
    'app/admin/polls/PollsClient.tsx',
    'app/admin/schedule/ScheduleClient.tsx',
    'app/admin/team/SquadClient.tsx',
    'components/AdminControlPanel.tsx',
    'components/MatchResultModal.tsx',
    'components/PlayerProfilePage.tsx',
    'components/ReadEditModal.tsx',
    'components/TeamListModal.tsx',
  ]) {
    const src = read(file)
    assert.match(src, /<Modal\b/, `${file} uses the shared Modal`)
    assert.doesNotMatch(src, /liga-modal-backdrop/, `${file} has no hand-rolled backdrop`)
  }
  assert.equal(declarations('html')['scrollbar-gutter'], 'stable', 'no sideways jump when scrolling locks')
})

test('Squad profiles open over the list via an intercepted route (dialog on desktop)', () => {
  for (const area of ['admin', 'dashboard']) {
    assert.match(read(`app/${area}/team/layout.tsx`), /\{children\}\s*\{modal\}/, `${area} Squad renders the @modal slot`)
    assert.match(read(`app/${area}/team/@modal/default.tsx`), /return null/)
    assert.match(read(`app/${area}/team/@modal/(.)[playerId]/page.tsx`), /<PlayerProfileView [^>]*\boverlay\b/)
    assert.ok(fs.existsSync(path.join(root, `app/${area}/team/[playerId]/page.tsx`)), 'direct visits keep the full page')
    assert.match(read(`app/${area}/team/SquadClient.tsx`), /router\.push\(`\/\w+\/team\/\$\{p\.id\}`, \{ scroll: false \}\)/, 'opening keeps the list scroll')
  }
  const profile = read('components/PlayerProfilePage.tsx')
  assert.match(profile, /useMediaQuery\(DESKTOP_QUERY\)/)
  assert.match(profile, /pathname\.endsWith\(`\/team\/\$\{props\.player\.id\}`\)/, 'stale slot renders nothing off the profile URL')
  assert.match(profile, /<Modal onClose=\{\(\) => router\.back\(\)\} size="md" bare fullScreen=\{fullScreen\}>/)
  // Phones get a full-page modal (covers header + nav, so the list can't show through)
  assert.match(profile, /presentation=\{isDesktop \? 'dialog' : 'fullScreen'\}/)
  const modal = read('components/Modal.tsx')
  assert.match(modal, /fullScreen \? 'h-full' : `rounded-t-2xl/, 'full-screen panel fills the viewport with no sheet styling')
  assert.match(modal, /fullScreen \? '' : 'sm:items-center sm:p-4'/, 'full-screen modal never insets')
  // Top Scorers / Top Assists sit side by side on phones too
  for (const area of ['admin', 'dashboard']) {
    assert.match(read(`app/${area}/team/SquadClient.tsx`), /<aside className="[^"]*\bgrid grid-cols-2\b[^"]*xl:grid-cols-1/)
  }
  assert.doesNotMatch(profile, /text-white\/8"/, 'jersey watermark uses a real opacity value')
  assert.match(read('lib/useMediaQuery.ts'), /DESKTOP_QUERY = '\(min-width: 1024px\)'/)
})

test('every page has its own tab title and profile names keep their spaces', () => {
  assert.match(read('app/layout.tsx'), /title: \{ default: 'ORA Hockey', template: '%s · ORA Hockey' \}/)
  for (const [file, title] of [
    ['app/admin/dashboard/page.tsx', 'Home'], ['app/admin/team/page.tsx', 'Squad'],
    ['app/admin/schedule/page.tsx', 'Schedule'], ['app/admin/polls/page.tsx', 'Polls'],
    ['app/admin/profile/page.tsx', 'Profile'], ['app/dashboard/page.tsx', 'Home'],
    ['app/dashboard/team/page.tsx', 'Squad'], ['app/dashboard/schedule/page.tsx', 'Schedule'],
    ['app/dashboard/polls/page.tsx', 'Polls'], ['app/login/layout.tsx', 'Sign in'],
    ['app/auth/confirm/layout.tsx', 'Account setup'], ['app/auth/set-password/layout.tsx', 'Set password'],
  ]) assert.match(read(file), new RegExp(`export const metadata: Metadata = \\{ title: '${title}' \\}`), `${file} → ${title}`)
  for (const area of ['admin', 'dashboard']) {
    assert.match(read(`app/${area}/team/[playerId]/page.tsx`), /generateMetadata[\s\S]*playerProfileMetadata\(params\.playerId\)/, 'profile title is the player name')
  }
  const profile = read('components/PlayerProfilePage.tsx')
  assert.match(profile, /\{before\}\{beforeSep && '\\u00a0'\}/, 'space after leading names survives the flex edge')
  assert.match(profile, /\{afterSep && '\\u00a0'\}\{after\}/, 'space before trailing names survives the flex edge')
})

test('admins and players share one Home dashboard', () => {
  assert.ok(read('app/dashboard/page.tsx').includes('<HomeView basePath="/dashboard" />'))
  assert.ok(read('app/admin/dashboard/page.tsx').includes('<HomeView basePath="/admin" />'))
  assert.ok(!fs.existsSync(path.join(root, 'components/admin/DashboardView.tsx')), 'no separate admin dashboard')
  const home = read('components/HomeView.tsx')
  assert.ok(!/href="\/(dashboard|admin)\//.test(home), 'links follow the caller section')
  assert.ok(home.includes('href={`${basePath}/schedule`}'))
  assert.ok(home.includes('href={`${basePath}/polls`}'))
  assert.ok(read('app/admin/layout.tsx').includes("{ href: '/admin/dashboard', label: 'Home', Icon: HomeIcon, exact: true }"))
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
