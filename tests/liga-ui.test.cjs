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

test('pilot typography, controls and shell are scoped to the four listing routes', () => {
  assert.match(read('components/AppShell.tsx'), /isLigaPilotPath\(pathname\)/)
  assert.match(read('app/dashboard/schedule/ScheduleClient.tsx'), /liga-page/)
  assert.match(read('app/admin/schedule/ScheduleClient.tsx'), /liga-page/)
  assert.match(read('components/EventRow.tsx'), /liga-event-row/)
  assert.equal(declarations('.liga-ui')['font-family'], 'var(--font-inter), ui-sans-serif, system-ui, sans-serif')
  assert.equal(declarations('.liga-ui .liga-meta')['font-family'], 'var(--font-liga-mono), ui-monospace, monospace')
  assert.equal(declarations('.liga-ui .liga-button')['min-height'], '44px')
  assert.equal(declarations('.liga-ui .liga-page')['margin-inline'], 'auto')
  assert.deepEqual(declarations('.liga-meta'), {}, 'metadata styles stay scoped to the pilot')
  assert.deepEqual(declarations('.liga-button'), {}, 'button styles stay scoped to the pilot')
  assert.deepEqual(declarations('.liga-page'), {}, 'page framing stays scoped to the pilot')
  assert.equal(declarations('.liga-ui .menu-dock')['backdrop-filter'], 'none')
  assert.match(read('components/BottomNav.tsx'), /safe-area-inset-bottom\)\+24px/)
  const ts = require('typescript')
  const compiled = ts.transpileModule(read('lib/liga-ui.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  new Function('exports', 'module', compiled)(module.exports, module)
  const { isLigaPilotPath } = module.exports
  for (const p of ['/dashboard/team', '/dashboard/schedule', '/admin/team', '/admin/schedule']) assert.equal(isLigaPilotPath(p), true)
  for (const p of ['/login', '/dashboard', '/admin/profile', '/dashboard/team/123', '/dashboard/polls', null]) assert.equal(isLigaPilotPath(p), false)
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
