/**
 * Checks the two things the canvas promises: widgets never end up stacked on
 * top of each other, and resizing the window never rewrites what is stored.
 *
 * This needs a real browser rather than `npm test`. Only a real drag, a real
 * resize and a real viewport change drive the grid library's own layout
 * machinery, and it was the layout it *emitted* on a resize - not anything the
 * reader did - that used to be written back over the stored arrangement.
 *
 *   npm run dev            # in another terminal
 *   node scripts/canvas-tests.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5178'

const widget = (id, type, x, y, w, h) => ({
  instance: { id, type, config: {}, surface: null },
  layout: { i: id, x, y, w, h },
})

/*
 * Five medium widgets on a six-column grid, spread across two rows. Wide enough
 * that a narrow viewport cannot show the arrangement and has to stack it.
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
    layout: DASHBOARD.map((w) => w.layout),
  },
})

const browser = await chromium.launch()

const open = async (width, compact, overrides = {}, height = 1000, layout = {}) => {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'dark' })
  page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))
  // Re-seeded on every navigation, a reload included, so overrides belong here
  // rather than in a later `evaluate` that the next reload would undo.
  const value = settings(compact)
  await page.addInitScript(
    ([seed]) => localStorage.setItem('newtab:local:settings', JSON.stringify(seed)),
    [
      {
        ...value,
        layout: { ...value.layout, ...layout },
        widgets: { ...value.widgets, ...overrides },
      },
    ],
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

const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('newtab:local:settings')).widgets.layout)

/** Asserts that the stored layout has no stacked pair. */
const checkStored = async (page, name) => {
  const found = overlaps((await stored(page)) ?? [])
  if (found.length === 0) passed += 1
  else failures.push(`${name}: ${found.join(', ')}`)
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
  await checkStored(page, `${compact}: on mount`)

  // Growing a widget is where one used to land on top of whatever was beside it.
  await page.locator('.react-grid-item').first().locator('.wframe__tool').first().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Large', exact: true }).click()
  await page.waitForTimeout(600)
  await checkStored(page, `${compact}: after growing a widget`)
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
  await checkStored(page, `${compact}: after dropping one onto another`)

  // Growing by the corner handle, which the library resolves by compaction.
  const handle = await page.locator('.react-resizable-handle').first().boundingBox()
  await dragTo(
    page,
    { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
    { x: handle.x + 220, y: handle.y + 180 },
  )
  await checkStored(page, `${compact}: after dragging the corner`)

  await page.close()
}

// Narrow viewports stack, and stacking must never reach storage.
for (const width of [700, 420]) {
  const page = await open(width, 'vertical')
  await checkStored(page, `${width}px viewport`)
  await page.close()
}

/*
 * The regression this whole redesign is for. Lock the canvas, take the window
 * down to a width that has to stack and back up again, and the stored layout
 * has to be byte-for-byte what it started as. This used to come back as a
 * single column, permanently, past a reload.
 */
const distinctColumns = (page) =>
  page.evaluate(
    () =>
      new Set(
        [...document.querySelectorAll('.react-grid-item')].map(
          (node) => Math.round(node.getBoundingClientRect().left / 10) * 10,
        ),
      ).size,
  )

for (const locked of [true, false]) {
  const how = locked ? 'locked' : 'unlocked'
  const page = await open(1440, 'vertical', { locked })

  const before = JSON.stringify(await stored(page))
  const widths = []
  for (const width of [900, 520, 380, 520, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForTimeout(500)
    widths.push([width, await distinctColumns(page)])
  }
  const after = JSON.stringify(await stored(page))

  if (before === after) passed += 1
  else failures.push(`${how}: resizing rewrote the layout\n    before ${before}\n    after  ${after}`)

  // And the arrangement is actually back on screen, not just intact on disk.
  const columns = await distinctColumns(page)
  if (columns > 1) passed += 1
  else failures.push(`${how}: widened window still a single column (${columns} distinct x)`)

  /*
   * A locked canvas stacks when it cannot fit; an unlocked one never does,
   * because a drag has to land the widget in the cell under the cursor.
   */
  const narrow = widths.find(([width]) => width === 380)[1]
  if (locked ? narrow === 1 : narrow > 1) passed += 1
  else failures.push(`${how}: 380px rendered ${narrow} distinct columns`)

  await page.close()
}

/*
 * The wheel has to work everywhere on the page, not just over the content.
 *
 * The content column is centred and capped, so there is dead space either side
 * of it - and the padding gutter beside the last widget. All of that used to
 * belong to a parent with `overflow: hidden`, so putting the pointer where a
 * reader naturally reaches for the edge scrolled nothing at all.
 */
for (const width of [1600, 420]) {
  // Short, so there is always something to scroll: at a tall viewport a wide
  // window fits the whole dashboard and the wheel has nowhere to go.
  const page = await open(width, 'vertical', { locked: true }, 600)
  const scrollTop = () => page.evaluate(() => document.querySelector('.page').scrollTop)
  const room = await page.evaluate(() => {
    const node = document.querySelector('.page')
    return node.scrollHeight - node.clientHeight
  })

  for (const [label, x] of [['left edge', 6], ['right edge', width - 6]]) {
    await page.evaluate(() => {
      document.querySelector('.page').scrollTop = 0
    })
    await page.waitForTimeout(250)
    await page.mouse.move(x, 400)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(500)

    const moved = await scrollTop()
    if (moved > 0) passed += 1
    else failures.push(`${width}px: wheel over the ${label} scrolled nothing (room: ${room})`)
  }

  await page.close()
}

/*
 * Nothing may be clipped off the top of the page.
 *
 * The page is the scroller, and centring its content with `justify-content`
 * pushes the overflow past both edges - but there is no scrollable area above
 * the origin, so whatever spills off the top cannot be reached at all. A
 * stacked portrait dashboard is taller than the window by design, so every
 * alignment has to keep the first widget reachable.
 */
for (const align of ['top', 'center', 'bottom']) {
  // Narrow and short, so the dashboard stacks and overflows.
  const page = await open(420, 'vertical', { locked: true }, 820, { align })

  // The alignment has to have actually reached the page for this to mean much.
  const applied = await page.evaluate(() =>
    document.querySelector('.page').getAttribute('data-align'),
  )
  if (applied === align) passed += 1
  else failures.push(`${align}: alignment did not apply (page says ${applied})`)

  const { contentTop, scrollTop, room } = await page.evaluate(() => {
    const node = document.querySelector('.page')
    return {
      contentTop: Math.round(document.querySelector('.page__content').getBoundingClientRect().top),
      scrollTop: node.scrollTop,
      room: node.scrollHeight - node.clientHeight,
    }
  })

  // Content above the viewport that no amount of scrolling can bring back.
  if (contentTop >= 0 || scrollTop > 0) passed += 1
  else failures.push(`${align}: content clipped off the top (top ${contentTop}, room ${room})`)

  await page.close()
}

await browser.close()

console.log(`${passed} checks passed, ${failures.length} failed`)
for (const failure of failures) console.log(`  ${failure}`)
if (failures.length) process.exitCode = 1
