/**
 * Produces Chrome Web Store screenshots from the built extension.
 *
 * Taken inside a real extension context rather than the dev server, so favicons
 * come from Chrome's own cache and the page is exactly what a reviewer sees.
 * Requires `npm run build` first.
 *
 *   node scripts/store-shots.mjs [outDir]
 */
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const dist = resolve('dist')
if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('dist/ is missing. Run `npm run build` first.')
  process.exit(1)
}

const outDir = resolve(process.argv[2] ?? './store')
mkdirSync(outDir, { recursive: true })

/** The store's required screenshot size. */
const SIZE = { width: 1280, height: 800 }

const widget = (id, type, x, y, w, h, config = {}) => ({
  instance: { id, type, config, surface: null },
  layout: { i: id, x, y, w, h },
})

// Sized to leave room for the search box and a full row of tiles at 1280x800.
const showcase = [
  widget('greet', 'greeting', 0, 0, 9, 2, { tone: 'greeting', size: 'm' }),
  widget('clock', 'clock', 17, 0, 7, 5, { style: 'analog-classic', showSeconds: true, showDate: false }),
  widget('cal', 'calendar', 9, 0, 8, 5),
  widget('todo', 'todo', 0, 2, 9, 3, {
    items: [
      { id: '1', text: 'Draft the launch note', done: false },
      { id: '2', text: 'Book the flights', done: true },
    ],
  }),
]

const scenes = [
  {
    name: '1-speed-dial',
    settings: { layout: { order: ['search', 'tiles'], align: 'center' } },
  },
  {
    name: '2-dashboard',
    settings: {
      widgets: {
        enabled: true,
        locked: true,
        rowHeight: 40,
        margin: 12,
        instances: showcase.map((w) => w.instance),
        layouts: { lg: showcase.map((w) => w.layout), md: showcase.map((w) => w.layout) },
      },
      tiles: { width: 150, aspect: 1.7, gap: 14, labelVisibility: 'always' },
      layout: { order: ['widgets', 'search', 'tiles'], maxWidth: 1160, paddingY: 24, gap: 20 },
    },
  },
  {
    name: '3-light-and-boxy',
    settings: {
      appearance: { mode: 'light', preset: 'paper', radius: 0, surface: 'solid' },
      tiles: { labelVisibility: 'always', plateStyle: 'neutral', aspect: 1.2, width: 150 },
      layout: { order: ['search', 'tiles'] },
    },
  },
  {
    name: '4-palette',
    settings: { layout: { order: ['search', 'tiles'] } },
    async act(page) {
      await page.keyboard.press('ControlOrMeta+k')
      await page.waitForTimeout(400)
      await page.keyboard.type('corner')
      await page.waitForTimeout(500)
    },
  },
  {
    name: '5-settings',
    settings: {},
    async act(page, id) {
      await page.goto(`chrome-extension://${id}/options.html`)
      await page.waitForTimeout(900)
    },
  },
]

for (const scene of scenes) {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'nt-store-')), {
    channel: 'chromium',
    headless: true,
    viewport: SIZE,
    colorScheme: scene.name.includes('light') ? 'light' : 'dark',
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  })

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  const id = new URL(worker.url()).host

  const page = await context.newPage()
  await page.setViewportSize(SIZE)
  await page.goto(`chrome-extension://${id}/newtab.html`)
  // Let the first run seed its tiles before overlaying the scene's settings.
  await page.waitForTimeout(1600)

  await page.evaluate(async (patch) => {
    const { settings } = await chrome.storage.local.get('settings')
    const merged = { ...settings }
    for (const [section, values] of Object.entries(patch)) {
      merged[section] = { ...merged[section], ...values }
    }
    await chrome.storage.local.set({ settings: merged })
  }, scene.settings)
  await page.waitForTimeout(900)

  if (scene.act) await scene.act(page, id)

  await page.screenshot({ path: join(outDir, `${scene.name}.png`) })
  console.log(`${scene.name}.png`)
  await context.close()
}
