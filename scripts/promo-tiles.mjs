/**
 * Renders the Chrome Web Store promo tiles.
 *
 * The store asks for a 440x280 small tile, and optionally a 920x680 marquee.
 * Both are drawn as HTML and shot with Playwright so they carry the same mark,
 * type and palette as the website, rather than being maintained twice.
 *
 *   node scripts/promo-tiles.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const outDir = resolve('marketing/promo')
mkdirSync(outDir, { recursive: true })

/** Inlined so the render needs no file:// access of its own. */
const inline = (name) =>
  'data:image/png;base64,' +
  readFileSync(resolve('marketing/screenshots', name)).toString('base64')

/**
 * Two shots, because the tiles carry a different claim than the widgets do.
 *
 * The wide art sits beside copy promising "tiles, widgets and a wallpaper
 * engine", which the tile grid alone does not show — so the dashboard carries
 * those, and the speed dial carries the tiles where there is no room for both.
 */
const shot = inline('speed-dial.png')
const dashShot = inline('dashboard.png')

/** Paper & Ink, the same palette the website uses. */
const C = {
  page: '#FAF9F6',
  surface: '#FFFFFF',
  border: '#E4E1D9',
  body: '#5A5750',
  head: '#1A1917',
  accent: '#2F5D50',
}

/**
 * Dots evenly spaced around a rounded square, as fractions of a 1x1 box.
 *
 * CSS `border: dotted` tiles each edge independently, so the dots drift out of
 * step and the corners go ragged. Placing them by hand instead: the perimeter
 * is walked as four straight runs plus four quarter arcs, the count is rounded
 * to a multiple of four so every side matches, and the walk starts a half-step
 * in so the pattern is symmetric about both axes and the corners land on arc.
 */
function ringDots(radius, target) {
  const straight = 1 - 2 * radius
  const arc = (Math.PI / 2) * radius
  const side = straight + arc
  const n = Math.max(4, Math.round(target / 4) * 4)
  const step = (4 * side) / n
  return Array.from({ length: n }, (_, i) => {
    const d = (i + 0.5) * step
    const quadrant = Math.floor(d / side)
    const t = d - quadrant * side
    let x
    let y
    if (t <= straight) {
      x = radius + t
      y = 0
    } else {
      const a = (t - straight) / radius
      x = 1 - radius + radius * Math.sin(a)
      y = radius - radius * Math.cos(a)
    }
    for (let q = 0; q < quadrant; q += 1) {
      const nx = 1 - y
      y = x
      x = nx
    }
    return [x, y]
  })
}

/**
 * The empty slot: the tile you fill yourself, drawn as a ring of dots.
 *
 * Twenty dots at ~14% of the cell, matching the favicon's proportion, which
 * leaves a clear gap between neighbours at every size the mark is used at.
 */
const slot = (cell) => {
  const dot = cell * 0.139
  const span = cell - dot
  return ringDots(0.18, 20)
    .map(
      ([x, y]) =>
        `<span style="position:absolute;width:${dot.toFixed(2)}px;height:${dot.toFixed(2)}px;
                      border-radius:50%;background:${C.page};
                      left:${(x * span).toFixed(2)}px;top:${(y * span).toFixed(2)}px"></span>`,
    )
    .join('')
}

/** The extension's own mark: a plate holding a 2x2 grid with one tile empty. */
const mark = (size) => {
  const cell = (size - size * 0.17 * 2 - size * 0.085) / 2
  return `
  <div style="width:${size}px;height:${size}px;border-radius:${size * 0.24}px;
              background:${C.head};display:grid;grid-template-columns:1fr 1fr;
              gap:${size * 0.085}px;padding:${size * 0.17}px;box-sizing:border-box;flex:none">
    ${[0, 1, 2, 3]
      .map((i) =>
        i === 1
          ? `<div style="position:relative;aspect-ratio:1">${slot(cell)}</div>`
          : `<div style="aspect-ratio:1;border-radius:${size * 0.07}px;background:${C.page};opacity:.9"></div>`,
      )
      .join('')}
  </div>`
}

const page = (w, h, body) => `<!doctype html>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px}
  body{background:${C.page};font-family:Inter,system-ui,sans-serif;color:${C.body};
       display:flex;overflow:hidden;
       background-image:radial-gradient(120% 90% at 100% 0%, #FFFFFF 0%, ${C.page} 55%)}
  h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;color:${C.head};letter-spacing:-.005em}
</style>
${body}`

const tiles = [
  {
    name: 'og-1200x630',
    w: 1200,
    h: 630,
    out: '../site/img/og.png',
    body: `<div style="padding:76px 80px 0;display:flex;flex-direction:column;gap:20px;width:100%">
      <div style="display:flex;align-items:center;gap:15px">
        ${mark(44)}
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:31px;color:${C.head};letter-spacing:-.005em">Open Slate</div>
      </div>
      <h1 style="font-size:64px;line-height:1.05;max-width:16ch">Your most-opened page, finally yours.</h1>
      <div style="font-size:19px;line-height:1.55;max-width:60ch">
        A speed dial and dashboard for the new tab — tiles, widgets and a
        wallpaper engine, with close to everything under your control.
      </div>
      <div style="margin-top:14px;border-radius:12px 12px 0 0;overflow:hidden;
                  box-shadow:0 -1px 0 ${C.border}, 0 24px 60px -20px rgba(26,25,23,.3)">
        <img src="${dashShot}" style="width:100%;display:block">
      </div>
    </div>`,
  },
  {
    name: 'small-tile-440x280',
    w: 440,
    h: 280,
    body: `<div style="padding:38px 40px;display:flex;flex-direction:column;justify-content:space-between;width:100%">
      <div style="display:flex;align-items:center;gap:13px">
        ${mark(38)}
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:26px;color:${C.head};letter-spacing:-.005em">Open Slate</div>
      </div>
      <div>
        <h1 style="font-size:31px;line-height:1.12;max-width:17ch">Your most-opened page, finally yours.</h1>
      </div>
      <div style="font-size:13px;color:${C.body};display:flex;align-items:center;gap:8px">
        <span style="width:16px;height:1px;background:${C.accent};display:inline-block"></span>
        Speed dial, widgets and wallpaper for the new tab
      </div>
    </div>`,
  },
  {
    name: 'marquee-1400x560',
    w: 1400,
    h: 560,
    body: `<div style="display:flex;align-items:center;width:100%;gap:56px;padding:0 0 0 84px">
      <div style="display:flex;flex-direction:column;gap:22px;flex:none;width:600px">
        <div style="display:flex;align-items:center;gap:16px">
          ${mark(46)}
          <div style="font-family:'Instrument Serif',Georgia,serif;font-size:32px;color:${C.head};letter-spacing:-.005em">Open Slate</div>
        </div>
        <h1 style="font-size:58px;line-height:1.06">Your most-opened page, finally yours.</h1>
        <div style="font-size:18px;line-height:1.55">
          A speed dial and dashboard for the new tab — tiles, widgets and a
          wallpaper engine, with close to everything under your control.
        </div>
        <div style="font-size:14px;display:flex;align-items:center;gap:10px;margin-top:4px">
          <span style="width:22px;height:1px;background:${C.accent};display:inline-block"></span>
          No analytics. Permissions only when a widget needs one.
        </div>
      </div>
      <div style="flex:1;align-self:stretch;position:relative;overflow:hidden">
        <img src="${dashShot}" style="position:absolute;top:50%;left:0;transform:translateY(-50%);
             width:820px;border-radius:14px 0 0 14px;
             box-shadow:0 24px 60px -18px rgba(26,25,23,.34), 0 0 0 1px ${C.border}">
      </div>
    </div>`,
  },
]

const browser = await chromium.launch()
for (const tile of tiles) {
  const ctx = await browser.newContext({
    viewport: { width: tile.w, height: tile.h },
    deviceScaleFactor: 1,
  })
  const p = await ctx.newPage()
  await p.setContent(page(tile.w, tile.h, tile.body), { waitUntil: 'networkidle' })
  // Give the webfonts a beat to paint before the shot.
  await p.waitForTimeout(700)
  const out = tile.out ? resolve(outDir, tile.out) : join(outDir, `${tile.name}.png`)
  await p.screenshot({ path: out })
  console.log(out.replace(process.cwd() + '/', ''))
  await ctx.close()
}
await browser.close()
