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
const shot = async (name, fn, { colorScheme = 'dark', reducedMotion, ...size } = {}) => {
  const page = await browser.newPage({
    viewport: { width: size.width ?? 1440, height: size.height ?? 900 },
    deviceScaleFactor: 1,
    colorScheme,
    reducedMotion,
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

/**
 * Seeds the settings blob before the page runs, so a screenshot can show any
 * configuration without clicking through the UI to build it.
 */
const seed = (page, settings) =>
  page.addInitScript(
    ([value]) => localStorage.setItem('newtab:local:settings', JSON.stringify(value)),
    [settings],
  )

const widget = (id, type, x, y, w, h, config = {}) => ({
  instance: { id, type, config, surface: null },
  layout: { i: id, x, y, w, h },
})

// Positions are in the standard grid: one cell is a small widget, and every
// footprint below is one of the sizes the picker offers.
const dashboard = [
  widget('g', 'greeting', 0, 0, 4, 1),
  widget('c', 'clock', 4, 0, 2, 1, { style: 'analog-classic', showSeconds: true, showDate: false }),
  widget('w', 'weather', 0, 1, 2, 2),
  widget('cal', 'calendar', 2, 1, 2, 2),
  widget('n', 'notes', 4, 1, 2, 2, { text: 'Ship the wallpaper engine.\nThen the palette.' }),
  widget('t', 'todo', 0, 3, 2, 2, {
    items: [
      { id: '1', text: 'Review the pull request', done: false },
      { id: '2', text: 'Book the flights', done: true },
      { id: '3', text: 'Reply to Anya', done: false },
    ],
  }),
  widget('k', 'continue', 2, 3, 4, 2),
]

const dashboardSettings = {
  version: 3,
  widgets: {
    enabled: true,
    locked: true,
    instances: dashboard.map((w) => w.instance),
    layouts: {
      lg: dashboard.map((w) => w.layout),
      md: dashboard.map((w) => w.layout),
      sm: dashboard.map((w) => w.layout),
    },
  },
  layout: { order: ['search', 'widgets', 'tiles'], maxWidth: 1320 },
}

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

await shot(
  'reduced-motion',
  async (page) => {
    await seed(page, dashboardSettings)
    await page.goto(`${base}/newtab.html`)
    await settle(page)
  },
  { reducedMotion: 'reduce', width: 1600, height: 1100 },
)

await shot('dashboard', async (page) => {
  await seed(page, dashboardSettings)
  await page.goto(`${base}/newtab.html`)
  await settle(page)
}, { width: 1600, height: 1100 })

// Browser-data widgets: outside the extension their queries return nothing, so
// this shot verifies the header, filter and empty states.
const browserDash = [
  widget('ts', 'topsites', 0, 0, 2, 2),
  widget('tb', 'tabs', 2, 0, 2, 2),
  widget('bm', 'bookmarks', 4, 0, 2, 2),
  widget('hi', 'history', 0, 2, 2, 2),
  widget('dl', 'downloads', 2, 2, 2, 2),
  widget('rc', 'continue', 4, 2, 2, 2),
]

await shot('dashboard-browser', async (page) => {
  await seed(page, {
    version: 3,
    widgets: {
      enabled: true,
      locked: true,
      instances: browserDash.map((w) => w.instance),
      layouts: { lg: browserDash.map((w) => w.layout) },
    },
    layout: { order: ['widgets'], maxWidth: 1400 },
    tiles: { enabled: false },
    search: { enabled: false },
  })
  await page.goto(`${base}/newtab.html`)
  await settle(page)
}, { width: 1600, height: 1000 })

await shot('widget-config', async (page) => {
  await seed(page, { ...dashboardSettings, widgets: { ...dashboardSettings.widgets, locked: false } })
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  await page.locator('.wframe__tool').first().click()
  await page.waitForTimeout(500)
}, { width: 1600, height: 1100 })

await shot('focus-ring', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  // Tab into the tile grid and step across it with the arrow keys.
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
})

await shot('palette', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  await page.keyboard.press('ControlOrMeta+k')
  await page.waitForTimeout(300)
  await page.keyboard.type('dark')
  await page.waitForTimeout(400)
})

await shot('search-typing', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  await page.locator('.search__input').fill('12 * (3 + 4)')
  await page.waitForTimeout(500)
})

await shot('search-engines', async (page) => {
  await page.goto(`${base}/newtab.html`)
  await settle(page)
  await page.locator('.search__enginebtn').click()
  await page.waitForTimeout(400)
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

// Arranging: the in-widget bars and the cell grid the widgets snap to.
await shot('widgets-arranging', async (page) => {
  await seed(page, { ...dashboardSettings, widgets: { ...dashboardSettings.widgets, locked: false } })
  await page.goto(`${base}/newtab.html`)
  await settle(page)
}, { width: 1600, height: 1200 })

// One scrolling page with the whole dashboard on it, for comparison with tabs.
await shot('view-scroll', async (page) => {
  await seed(page, {
    ...dashboardSettings,
    layout: { ...dashboardSettings.layout, viewMode: 'scroll' },
  })
  await page.goto(`${base}/newtab.html`)
  await settle(page)
}, { height: 1200 })

for (const pane of ['widgets', 'tiles']) {
  await shot(`view-tabs-${pane}`, async (page) => {
    await seed(page, {
      ...dashboardSettings,
      layout: { ...dashboardSettings.layout, viewMode: 'tabs', defaultPane: pane },
    })
    await page.goto(`${base}/newtab.html`)
    await settle(page)
  })
}

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
