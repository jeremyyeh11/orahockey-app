#!/usr/bin/env node
// Takes the What's new screenshots for a release (lib/whats-new.ts) into
// public/whats-new/<release id>/: a 390×844 phone viewport at 2x, each shot
// clipped to the part of the page that matters, full width.
//
//   SHOT_EMAIL=… SHOT_PASSWORD=… node scripts/whats-new-shots.cjs <release id>
//
// BASE_URL defaults to http://localhost:3000 (npm run dev). Sign in with an
// account whose role suits the shots: an admin for admin-only items. Add each
// new release's shots to SHOTS below.

const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const MARGIN = 16

/**
 * name:    file name (public/whats-new/<release>/<name>.png)
 * path:    page to open after signing in
 * prepare: optional steps on the page before the shot
 * clip:    selectors; the shot is the band of the screen that covers them all
 */
/** Fines tab: step back month by month to the latest one with an unpaid fine */
async function toMonthWithUnpaidFines(page) {
  for (let i = 0; i < 12; i++) {
    if ((await page.locator('.liga-fine:has(button:has-text("Paid"))').count()) > 0) return
    await page.getByRole('link', { name: '← Prev' }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  }
  throw new Error('No month with unpaid fines in the last year')
}

const SHOTS = {
  // Sign in as a Finemaster (or the superadmin) for the + Fine and Delete shots.
  // The account should have the tour done and this release seen, so nothing covers the page.
  '2026-11-fines': [
    {
      name: 'all-months',
      path: '/dashboard/fines',
      prepare: toMonthWithUnpaidFines,
      clip: ['.liga-fines-status', 'button:has-text("Copy all outstanding")'],
    },
    {
      name: 'add-fine',
      path: '/dashboard/fines',
      async prepare(page) {
        await page.getByRole('button', { name: '+ Fine' }).click()
        const select = page.locator('#fine-player')
        const firstPlayer = await select.locator('option:not([value=""])').first().getAttribute('value')
        await select.selectOption(firstPlayer)
        await page.locator('.liga-fine-presets button', { hasText: 'Late arrival' }).click()
        await page.fill('#fine-amount', '500')
        await page.waitForTimeout(300)
      },
      clip: ['.liga-modal-panel'],
    },
    {
      name: 'delete',
      path: '/dashboard/fines',
      prepare: toMonthWithUnpaidFines,
      clip: ['.liga-fines-player:has(button:has-text("Paid"))'],
    },
  ],
}

async function main() {
  const release = process.argv[2]
  const shots = SHOTS[release]
  if (!shots) throw new Error(`No shots for "${release}". Known: ${Object.keys(SHOTS).join(', ')}`)
  const { SHOT_EMAIL, SHOT_PASSWORD } = process.env
  if (!SHOT_EMAIL || !SHOT_PASSWORD) throw new Error('Set SHOT_EMAIL and SHOT_PASSWORD')

  const outDir = path.join(__dirname, '..', 'public', 'whats-new', release)
  fs.mkdirSync(outDir, { recursive: true })

  // Behind an HTTPS proxy (cloud sessions), the browser goes through it too
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined
  const browser = await chromium.launch({ proxy })
  try {
    for (const shot of shots) {
      // A fresh sign-in per shot, so one shot's state never leaks into the next
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: 'en-GB',
        timezoneId: 'Asia/Singapore',
      })
      const page = await context.newPage()
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', SHOT_EMAIL)
      await page.fill('input[type="password"]', SHOT_PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 })

      await page.goto(`${BASE_URL}${shot.path}`)
      await page.waitForLoadState('networkidle')
      if (shot.prepare) await shot.prepare(page)

      // Centre the first element on screen, clear of the header and the floating nav
      await page.locator(shot.clip[0]).first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await page.waitForTimeout(300)
      const boxes = []
      for (const sel of shot.clip) {
        const box = await page.locator(sel).first().boundingBox()
        if (!box) throw new Error(`${shot.name}: "${sel}" isn't on the page`)
        boxes.push(box)
      }
      const vh = page.viewportSize().height
      const top = Math.max(0, Math.min(...boxes.map((b) => b.y)) - MARGIN)
      const bottom = Math.min(vh, Math.max(...boxes.map((b) => b.y + b.height)) + MARGIN)
      const file = path.join(outDir, `${shot.name}.png`)
      await page.screenshot({ path: file, clip: { x: 0, y: top, width: 390, height: bottom - top } })
      console.log(`saved ${path.relative(process.cwd(), file)}`)
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
