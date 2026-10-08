const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

// Load the real lib/*.ts (with @/ imports) without a build step
function load(file, cache = new Map()) {
  const filename = [file, `${file}.ts`].map((f) => path.resolve(root, f)).find((f) => fs.existsSync(f) && fs.statSync(f).isFile())
  assert.ok(filename, `Cannot resolve ${file}`)
  if (cache.has(filename)) return cache.get(filename).exports
  const mod = { exports: {} }
  cache.set(filename, mod)
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const req = (s) => (s.startsWith('@/') ? load(s.slice(2), cache) : require(s))
  new Function('require', 'module', 'exports', outputText)(req, mod, mod.exports)
  return mod.exports
}

const { defaultRespondBy, defaultFinesEnabled, computeFines, finesByPlayer, fineMonth, FINE_AMOUNT } = load('lib/fines.ts')
const sg = (local) => new Date(`${local}+08:00`).toISOString()
const posted = new Date(sg('2026-10-01T10:00:00'))

test('respond-by follows the club rules (Singapore time)', () => {
  // Weekend game/training → Thursday before, 23:59
  assert.equal(defaultRespondBy('training', { start: sg('2026-10-10T09:00:00'), postedAt: posted }), sg('2026-10-08T23:59:59'), 'Sat training → Thu')
  assert.equal(defaultRespondBy('game', { start: sg('2026-10-11T15:00:00'), postedAt: posted }), sg('2026-10-08T23:59:59'), 'Sun game → Thu')
  // Saturday 01:30 SGT is still Friday in UTC — the SG day decides
  assert.equal(defaultRespondBy('training', { start: sg('2026-10-10T01:30:00'), postedAt: posted }), sg('2026-10-08T23:59:59'))
  // Weekday training → Sunday before, 23:59
  assert.equal(defaultRespondBy('training', { start: sg('2026-10-13T20:00:00'), postedAt: posted }), sg('2026-10-11T23:59:59'), 'Tue training → Sun')
  assert.equal(defaultRespondBy('training', { start: sg('2026-10-12T20:00:00'), postedAt: posted }), sg('2026-10-11T23:59:59'), 'Mon training → day before')
  assert.equal(defaultRespondBy('training', { start: sg('2026-10-16T20:00:00'), postedAt: posted }), sg('2026-10-11T23:59:59'), 'Fri training → Sun')
  // Weekday game → 72h before
  assert.equal(defaultRespondBy('game', { start: sg('2026-10-14T20:00:00'), postedAt: posted }), sg('2026-10-11T20:00:00'), 'Wed game → 72h before')
  // Team event / poll → 72h after posting, capped at start / close
  assert.equal(defaultRespondBy('event', { start: sg('2026-10-20T19:00:00'), postedAt: posted }), sg('2026-10-04T10:00:00'))
  assert.equal(defaultRespondBy('event', { start: sg('2026-10-02T19:00:00'), postedAt: posted }), sg('2026-10-02T19:00:00'), 'never after the start')
  assert.equal(defaultRespondBy('poll', { postedAt: posted }), sg('2026-10-04T10:00:00'))
  assert.equal(defaultRespondBy('poll', { postedAt: posted, closesAt: sg('2026-10-02T12:00:00') }), sg('2026-10-02T12:00:00'), 'never after the poll closes')
  assert.equal(defaultRespondBy('game', { start: null, postedAt: posted }), null)
})

test('fines default: on for games/trainings/polls, off for team events and for anything posted after its deadline', () => {
  assert.equal(defaultFinesEnabled('training', sg('2026-10-08T23:59:59'), posted), true)
  assert.equal(defaultFinesEnabled('poll', sg('2026-10-04T10:00:00'), posted), true)
  assert.equal(defaultFinesEnabled('event', sg('2026-10-04T10:00:00'), posted), false)
  assert.equal(defaultFinesEnabled('training', sg('2026-09-30T23:59:59'), posted), false, 'posted after its deadline')
  assert.equal(defaultFinesEnabled('game', null, posted), false)
})

test('late replies: after the deadline or never, only once the deadline has passed', () => {
  const entry = {
    kind: 'training', id: 't1', title: 'Training', start: sg('2026-10-10T09:00:00'), respondBy: sg('2026-10-08T23:59:59'),
    finesEnabled: true, expected: ['onTime', 'late', 'never', 'lateThenEarly'],
  }
  const change = (player_id, changed_at, status = 'attending', previous_status = null) => ({
    player_id, session_id: 't1', session_type: 'training', status, previous_status, changed_at, changed_by: `auth-${player_id}`,
  })
  const changes = [
    change('onTime', sg('2026-10-07T12:00:00')),
    change('late', sg('2026-10-09T08:00:00')),
    change('lateThenEarly', sg('2026-10-08T22:00:00'), 'maybe'),
    change('lateThenEarly', sg('2026-10-09T08:00:00'), 'attending', 'maybe'), // 25h before: not a late change
  ]
  const args = { entries: [entry], changes, votes: [], waivers: [], authIdOf: (p) => `auth-${p}` }

  assert.deepEqual(computeFines({ ...args, now: new Date(sg('2026-10-08T20:00:00')) }), [], 'nothing before the deadline')

  const fines = computeFines({ ...args, now: new Date(sg('2026-10-09T12:00:00')) })
  assert.deepEqual(fines.map((f) => [f.playerId, f.reason, f.repliedAt]), [
    ['late', 'late_reply', sg('2026-10-09T08:00:00')],
    ['never', 'late_reply', null],
  ], 'the first reply counts, so a later change is not a late reply')
  assert.equal(fines[0].at, entry.respondBy, 'a late reply happens when the deadline passes')
  assert.equal(fineMonth(fines[0]), '2026-10')

  const off = computeFines({ ...args, entries: [{ ...entry, finesEnabled: false }], now: new Date(sg('2026-10-12T00:00:00')) })
  assert.deepEqual(off, [], 'fines off = no fines')
  const noDeadline = computeFines({ ...args, entries: [{ ...entry, respondBy: null }], now: new Date(sg('2026-10-12T00:00:00')) })
  assert.deepEqual(noDeadline, [])
})

test('late changes: own change within 24h of the start, one per event; waivers keep the row but drop the total', () => {
  const entry = {
    kind: 'game', id: 'g1', title: 'ORA vs X', start: sg('2026-10-10T15:00:00'), respondBy: sg('2026-10-08T23:59:59'),
    finesEnabled: true, expected: ['a', 'b', 'c', 'd'],
  }
  const change = (player_id, changed_at, status, previous_status, changed_by = `auth-${player_id}`) => ({
    player_id, session_id: 'g1', session_type: 'game', status, previous_status, changed_at, changed_by,
  })
  const changes = [
    ...['a', 'b', 'c', 'd'].map((p) => change(p, sg('2026-10-07T10:00:00'), 'attending', null)),
    change('a', sg('2026-10-10T08:00:00'), 'not_attending', 'attending'),
    change('a', sg('2026-10-10T09:00:00'), 'maybe', 'not_attending'),
    change('b', sg('2026-10-09T14:00:00'), 'maybe', 'attending'),
    change('c', sg('2026-10-10T07:00:00'), 'not_attending', 'attending', 'auth-admin'),
    change('d', sg('2026-10-10T16:00:00'), 'not_attending', 'attending'),
  ]
  const fines = computeFines({
    entries: [entry], changes, votes: [],
    waivers: [{ player_id: 'a', item_type: 'game', item_id: 'g1', reason: 'late_change' }],
    authIdOf: (p) => `auth-${p}`,
    now: new Date(sg('2026-10-11T00:00:00')),
  })
  assert.deepEqual(fines.map((f) => [f.playerId, f.reason, f.from, f.to, f.at, f.waived]), [
    ['a', 'late_change', 'attending', 'not_attending', sg('2026-10-10T08:00:00'), true],
  ], 'b changed 25h before; c was changed by an admin; d changed after the start')

  const totals = finesByPlayer(fines)
  assert.deepEqual(totals.map((t) => [t.playerId, t.count, t.total]), [['a', 0, 0]], 'waived fines stay listed but cost nothing')
})

test('polls: the vote time decides; totals are $5 a fine, most owed first', () => {
  const poll = { kind: 'poll', id: 'p1', title: 'Jersey size', start: null, respondBy: sg('2026-10-04T10:00:00'), finesEnabled: true, expected: ['x', 'y', 'z'] }
  const votes = [
    { poll_id: 'p1', player_id: 'x', voted_at: sg('2026-10-02T10:00:00') },
    { poll_id: 'p1', player_id: 'y', voted_at: sg('2026-10-05T10:00:00') },
  ]
  const training = {
    kind: 'training', id: 't9', title: 'Training', start: sg('2026-10-10T09:00:00'), respondBy: sg('2026-10-08T23:59:59'),
    finesEnabled: true, expected: ['z'],
  }
  const fines = computeFines({ entries: [poll, training], changes: [], votes, waivers: [], authIdOf: () => null, now: new Date(sg('2026-10-20T00:00:00')) })
  assert.deepEqual(fines.map((f) => [f.playerId, f.kind]), [['y', 'poll'], ['z', 'poll'], ['z', 'training']])
  const totals = finesByPlayer(fines)
  assert.deepEqual(totals.map((t) => [t.playerId, t.total]), [['z', 2 * FINE_AMOUNT], ['y', FINE_AMOUNT]])
  assert.equal(FINE_AMOUNT, 5)
})
