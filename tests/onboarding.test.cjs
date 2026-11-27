const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

// Plain TS modules (no imports) loaded without a build
function loadTs(file) {
  const { outputText } = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(require, mod, mod.exports)
  return mod.exports
}

test("What's new: every release is well formed and its screenshots exist", () => {
  const { RELEASES, LATEST_RELEASE_ID } = loadTs('lib/whats-new.ts')
  assert.ok(RELEASES.length > 0)
  assert.equal(LATEST_RELEASE_ID, RELEASES[0].id)
  const ids = new Set()
  let prevDate = '9999-12-31'
  for (const r of RELEASES) {
    assert.match(r.id, /^\d{4}-\d{2}-[a-z0-9-]+$/, `${r.id}: "YYYY-MM-short-name"`)
    assert.ok(!ids.has(r.id), `${r.id} is unique`)
    ids.add(r.id)
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(r.date <= prevDate, `${r.id}: newest first`)
    prevDate = r.date
    assert.ok(r.items.length > 0 && r.items.length <= 5, `${r.id}: 1–5 items`)
    for (const item of r.items) {
      assert.ok(item.title.length > 0 && item.title.length <= 40, `${r.id}: "${item.title}" title ≤ 40 chars`)
      assert.ok(item.body.length > 0 && item.body.length <= 160, `${r.id}: "${item.title}" body ≤ 160 chars (keep it short)`)
      assert.ok(item.image, `${r.id}: "${item.title}" has a screenshot`)
      assert.ok(item.only === undefined || ['admin', 'fines'].includes(item.only), `${r.id}: "${item.title}" only is admin or fines`)
      assert.ok(item.image.startsWith(`/whats-new/${r.id}/`), `${item.image} lives in public/whats-new/${r.id}/`)
      assert.ok(fs.existsSync(path.join(root, 'public', item.image)), `${item.image} exists`)
    }
  }
})

test("What's new: players see only releases they haven't, without admin-only items", () => {
  const wn = loadTs('lib/whats-new.ts')
  wn.RELEASES.splice(0, wn.RELEASES.length,
    { id: '2027-03-c', date: '2027-03-01', items: [{ title: 'C', body: 'c', only: 'admin' }] },
    { id: '2027-02-b', date: '2027-02-01', items: [{ title: 'B', body: 'b' }, { title: 'B fines', body: 'b', only: 'fines' }] },
    { id: '2027-01-a', date: '2027-01-01', items: [{ title: 'A', body: 'a' }] },
  )
  const admin = { isAdmin: true, fineManager: false }
  const player = { isAdmin: false, fineManager: false }
  const finemaster = { isAdmin: false, fineManager: true }
  const ids = (rs) => rs.map((r) => r.id)
  const titles = (rs) => rs.flatMap((r) => r.items.map((i) => i.title))
  assert.deepEqual(ids(wn.unseenReleases('2027-01-a', admin)), ['2027-03-c', '2027-02-b'])
  assert.deepEqual(ids(wn.unseenReleases('2027-01-a', player)), ['2027-02-b'], 'a release with only admin items is dropped for players')
  assert.deepEqual(titles(wn.unseenReleases('2027-01-a', player)), ['B'])
  assert.deepEqual(titles(wn.unseenReleases('2027-01-a', admin)), ['C', 'B'], 'admins without the Finemaster title skip fines items')
  assert.deepEqual(titles(wn.unseenReleases('2027-01-a', finemaster)), ['B', 'B fines'], 'a Finemaster player gets fines items')
  assert.deepEqual(ids(wn.unseenReleases('2027-03-c', admin)), [], 'up to date')
  assert.deepEqual(ids(wn.unseenReleases(null, admin)), ['2027-03-c'], 'never seen any: just the latest')
  assert.deepEqual(ids(wn.unseenReleases('gone', admin)), ['2027-03-c'], 'unknown id: just the latest')
})

test('tour: every target is tagged in the app, admin steps only for admins', () => {
  const { TOUR_STEPS, tourSteps } = loadTs('lib/tour.ts')
  const sources = [
    'components/HomeView.tsx', 'components/SeasonSwitcher.tsx', 'components/BottomNav.tsx',
    'components/TopNav.tsx', 'app/admin/AdminShell.tsx',
  ].map(read).join('\n')
  for (const s of TOUR_STEPS.filter((s) => s.target)) {
    const literal = sources.includes(`data-tour="${s.target}"`)
    const nav = s.target.startsWith('nav-') && /data-tour=\{`nav-\$\{item\.label\.toLowerCase\(\)\}`\}/.test(read('components/BottomNav.tsx'))
    assert.ok(literal || nav, `data-tour="${s.target}" is on the page`)
    assert.ok(s.body.length <= 140, `${s.target}: caption ≤ 140 chars`)
  }
  assert.match(read('components/TopNav.tsx'), /data-tour=\{`nav-\$\{item\.label\.toLowerCase\(\)\}`\}/, 'desktop nav is tagged too')
  assert.match(read('components/HomeView.tsx'), /data-tour="home"/, 'the tour waits for Home to render')
  assert.ok(tourSteps(true).some((s) => s.adminOnly))
  assert.ok(!tourSteps(false).some((s) => s.adminOnly))
  const squad = (steps) => steps.find((s) => s.target === 'nav-squad').body
  assert.match(squad(tourSteps(true)), /Add players/)
  assert.doesNotMatch(squad(tourSteps(false)), /Add players/)
})

test('onboarding state: own row only, saved by player actions, loaded by both layouts', () => {
  const sql = read('supabase/migrations/045_onboarding.sql')
  assert.match(sql, /enable row level security/)
  for (const op of ['select', 'insert', 'update']) {
    assert.match(sql, new RegExp(`for ${op} [^;]*auth_user_id = auth\\.uid\\(\\)`), `${op} is limited to your own row`)
  }
  assert.doesNotMatch(sql, /for (all|delete)/)
  assert.match(sql, /not exists \(select 1 from public\.player_onboarding\)/, 'existing accounts are backfilled on the first run only')

  const actions = read('app/dashboard/profile/actions.ts')
  for (const name of ['finishTour', 'markWhatsNewSeen']) {
    assert.match(actions, new RegExp(String.raw`export const ${name} = action\(async \([^)]*\) => \{\s+const supabase = createClient\(\)\s+const playerId = await requirePlayerId\(supabase\)`), `${name} saves for the signed-in player`)
  }
  assert.match(actions, /seen_release: LATEST_RELEASE_ID/, 'the server picks the release, not the browser')

  for (const area of ['admin', 'dashboard']) {
    assert.match(read(`app/${area}/layout.tsx`), /getOnboarding\(\)[\s\S]*onboarding=\{onboarding\}/)
  }
  assert.match(read('components/AppShell.tsx'), /<Onboarding state=\{onboarding \?\? null\} isAdmin=\{isAdmin\} fineManager=\{fineManager\} homeHref=\{nav\[0\]\.href\} \/>/)
  for (const shell of ['app/admin/AdminShell.tsx', 'app/dashboard/DashboardShell.tsx']) {
    assert.match(read(shell), /fineManager=\{canManageFines\(viewer\.role, viewer\.titles\)\}/, `${shell}: fines items follow can_manage_fines()`)
  }
  const profile = read('components/MyProfile.tsx')
  assert.match(profile, /new Event\(START_TOUR_EVENT\)[\s\S]*Take the tour/)
  assert.match(profile, /new Event\(OPEN_WHATS_NEW_EVENT\)[\s\S]*What&apos;s new/)
})

test('everyone gets the tour until they finish it once; existing players see What’s new after it', () => {
  const src = read('components/onboarding/Onboarding.tsx')
  assert.match(src, /useState\(\(\) => !!state && !state\.tourDone\)/, 'the tour is due whenever it was never finished, new or existing account')
  assert.match(src, /finishTour\(!!state\?\.isNew\)/, 'only a new account’s tour marks the releases seen')
  assert.match(src, /if \(!firstTour\) return/, 'a replay from Profile saves nothing')
  assert.match(src, /state\?\.tourDone \? unseen : \[\]/, 'What’s new waits for the tour')
  assert.doesNotMatch(read('lib/whats-new.ts'), /action\?: 'tour'/, 'What’s new no longer advertises the tour')
})
