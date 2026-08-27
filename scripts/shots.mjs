/**
 * Screenshot harness for manual review.
 *
 * A new tab page is almost entirely visual, and much of its behaviour only
 * exists on hover or behind a settings tab, so eyeballing the built page is the
 * only honest way to check a change. Run the dev server, then:
 *
 *   node scripts/shots.mjs [baseUrl] [outDir]
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5178'
const outDir = resolve(process.argv[3] ?? './shots')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const shot = async (name, fn, { colorScheme = 'dark', ...size } = {}) => {
  const page = await browser.newPage({
    viewport: { width: size.width ?? 1440, height: size.height ?? 900 },
    deviceScaleFactor: 1,
    colorScheme,
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`  [${name}] console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => console.error(`  [${name}] pageerror: ${err.message}`))
  await fn(page)
  await page.screenshot({ path: resolve(outDir, `${name}.png`) })
  await page.close()
  console.log(`${name}.png`)
}

const settle = (page) => page.waitForTimeout(900)

for (const scheme of ['dark', 'light']) {
  await shot(
    `newtab-${scheme}`,
    async (page) => {
      await page.goto(`${base}/newtab.html`)
      await settle(page)
    },
    { colorScheme: scheme },
  )
}

await shot('newtab-hover', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  const tile = page.locator('.tile').first()
  if (await tile.count()) await tile.hover()
  await page.waitForTimeout(400)
})

await shot('tile-editor', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  const add = page.locator('.tile-add')
  if (await add.count()) {
    await add.click()
    await page.locator('.ctl-input').first().fill('netflix.com')
    await page.waitForTimeout(700)
  }
})

await shot('widgets-editing', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  const arrange = page.locator('.canvas__btn', { hasText: 'Arrange' })
  if (await arrange.count()) await arrange.click()
  await page.waitForTimeout(400)
})

await shot('widget-picker', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  const add = page.locator('.canvas__btn', { hasText: 'Widget' })
  if (await add.count()) await add.click()
  await page.waitForTimeout(500)
})

// One shot per settings section, driven through the real navigation.
await shot('settings', async (page) => {
  await page.goto(`${base}/options.html`)
  await settle(page)
})

const sections = await (async () => {
  const page = await browser.newPage()
  await page.goto(`${base}/options.html`)
  await page.waitForSelector('.settings__navitem')
  const labels = await page.locator('.settings__navitem').allInnerTexts()
  await page.close()
  return labels.map((l) => l.trim()).filter(Boolean)
})()

for (const label of sections) {
  await shot(
    `settings-${label.toLowerCase().replace(/\W+/g, '-')}`,
    async (page) => {
      await page.goto(`${base}/options.html`)
      await page.waitForSelector('.settings__navitem')
      await page.getByRole('button', { name: label, exact: true }).click()
      await settle(page)
    },
    { width: 1200, height: 1100 },
  )
}

await browser.close()
