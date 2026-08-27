/**
 * Checks that widgets never end up stacked on top of each other.
 *
 * This needs a real browser rather than `npm test`: the grid library only
 * validates the breakpoint it is currently rendering, so the interesting bugs
 * live in the layouts that are *off* screen, and only a real drag, a real
 * resize and a real viewport change produce them. The stored blob is read back
 * after each gesture and every breakpoint is checked, not just the visible one.
 *
 *   npm run dev            # in another terminal
 *   node scripts/canvas-tests.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5178'
const BREAKPOINTS = ['lg', 'md', 'sm']

const widget = (id, type, x, y, w, h) => ({
  instance: { id, type, config: {}, surface: null },
  layout: { i: id, x, y, w, h },
})

/*
 * Five medium widgets on a six-column grid. Deliberately wider than the `md`
 * (four) and `sm` (two) column counts, so every stored position has to be
 * clamped — which is what used to pile them onto the same cell.
 */
const DASHBOARD = [
  widget('a', 'clock', 0, 0, 2, 1),
  widget('b', 'weather', 2, 0, 2, 1),
  widget('c', 'notes', 4, 0, 2, 1),
  widget('d', 'todo', 0, 1, 2, 1),
  widget('e', 'calendar', 2, 1, 2, 1),
]

const collides = (a, b) =>
  a.i !== b.i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const overlaps = (items) => {
  const found = []
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (collides(items[i], items[j])) found.push(`${items[i].i}/${items[j].i}`)
    }
  }
  return found
}

const failures = []
let passed = 0

const settings = (compact) => ({
  version: 3,
  layout: { order: ['search', 'widgets', 'tiles'], align: 'top' },
  widgets: {
    enabled: true,
    locked: false,
    columns: 6,
    margin: 14,
    compact,
    instances: DASHBOARD.map((w) => w.instance),
    layouts: Object.fromEntries(BREAKPOINTS.map((bp) => [bp, DASHBOARD.map((w) => w.layout)])),
  },
})

const browser = await chromium.launch()

const open = async (width, compact) => {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: 'dark' })
  page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))
  await page.addInitScript(
    ([value]) => localStorage.setItem('newtab:local:settings', JSON.stringify(value)),
    [settings(compact)],
  )
  try {
    await page.goto(`${base}/newtab.html`)
  } catch {
    console.error(`Could not reach ${base}. Start the dev server with \`npm run dev\`.`)
    await browser.close()
    process.exit(1)
  }
  await page.waitForTimeout(1200)
  return page
}

const stored = (page, breakpoint) =>
  page.evaluate(
    (bp) => JSON.parse(localStorage.getItem('newtab:local:settings')).widgets.layouts[bp],
    breakpoint,
  )

/** Asserts that no breakpoint in the stored blob has a stacked pair. */
const checkEveryBreakpoint = async (page, name) => {
  for (const breakpoint of BREAKPOINTS) {
    const found = overlaps((await stored(page, breakpoint)) ?? [])
    if (found.length === 0) passed += 1
    else failures.push(`${name} (${breakpoint}): ${found.join(', ')}`)
  }
}

/** A slow drag, so the library sees the intermediate positions a person makes. */
const dragTo = async (page, from, to) => {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / 12,
      from.y + ((to.y - from.y) * step) / 12,
    )
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(700)
}

for (const compact of ['vertical', 'horizontal', 'none']) {
  const page = await open(1440, compact)
  await checkEveryBreakpoint(page, `${compact}: on mount`)

  // The size picker writes to every breakpoint at once, which is where a
  // grown widget used to land on top of whatever was already beside it.
  await page.locator('.react-grid-item').first().locator('.wframe__tool').first().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Large', exact: true }).click()
  await page.waitForTimeout(600)
  await checkEveryBreakpoint(page, `${compact}: after growing a widget`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Drop one widget squarely on top of another.
  const source = await page.locator('.react-grid-item').nth(3).boundingBox()
  const target = await page.locator('.react-grid-item').nth(2).boundingBox()
  await dragTo(
    page,
    { x: source.x + 40, y: source.y + 10 },
    { x: target.x + 40, y: target.y + 30 },
  )
  await checkEveryBreakpoint(page, `${compact}: after dropping one onto another`)

  // Growing by the corner handle, which the library resolves by compaction.
  const handle = await page.locator('.react-resizable-handle').first().boundingBox()
  await dragTo(
    page,
    { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
    { x: handle.x + 220, y: handle.y + 180 },
  )
  await checkEveryBreakpoint(page, `${compact}: after dragging the corner`)

  await page.close()
}

// Narrow viewports render the layouts that used to go unchecked entirely.
for (const width of [700, 420]) {
  const page = await open(width, 'vertical')
  await checkEveryBreakpoint(page, `${width}px viewport`)
  await page.close()
}

await browser.close()

console.log(`${passed} checks passed, ${failures.length} failed`)
for (const failure of failures) console.log(`  ${failure}`)
if (failures.length) process.exitCode = 1
