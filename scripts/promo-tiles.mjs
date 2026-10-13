/**
 * Renders the Chrome Web Store promo tiles and the Open Graph image.
 * Drawn as HTML and shot with Playwright, in the same look as the website.
 *
 *   node scripts/promo-tiles.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const outDir = resolve('marketing/promo')
mkdirSync(outDir, { recursive: true })

const dataUrl = (file, type) => `data:${type};base64,${readFileSync(resolve(file)).toString('base64')}`
const shot = dataUrl('marketing/screenshots/wallpaper.png', 'image/png')
const logo = dataUrl('marketing/site/favicon.svg', 'image/svg+xml')

const C = { paper: '#FBFAF6', card: '#FEFDF9', ink: '#1E2421', soft: '#566058', dot: '#CBD0C6', accent: '#2F5D50', mark: '#F2D95C' }
const WOBBLE = '16px 5px 14px 6px / 6px 14px 5px 16px'

const brand = (size, font) => `
  <div style="display:flex;align-items:center;gap:${size * 0.3}px">
    <img src="${logo}" style="width:${size}px;height:${size}px">
    <div style="font-weight:700;font-size:${font}px;letter-spacing:-.01em;color:${C.ink}">Open Slate</div>
  </div>`

const headline = (size, extra = '') => `
  <h1 style="font-size:${size}px;line-height:1.04;font-weight:700;letter-spacing:-.03em;color:${C.ink};${extra}">
    A blank tab is a <span class="hl">blank page.</span> Sketch on it.
  </h1>`

const frame = (img, style = '') => `
  <div style="background:${C.card};border:2px solid ${C.ink};border-radius:${WOBBLE};padding:10px;
              box-shadow:7px 7px 0 ${C.dot};${style}">
    <img src="${img}" style="width:100%;display:block;border-radius:8px 3px 7px 4px">
  </div>`

const page = (w, h, body) => `<!doctype html>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700&family=Caveat:wght@500&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px}
  body{background-color:${C.paper};background-image:radial-gradient(${C.dot} 1.2px,transparent 1.4px);background-size:24px 24px;
       font-family:'Bricolage Grotesque',system-ui,sans-serif;color:${C.soft};display:flex;overflow:hidden}
  .hl{position:relative;isolation:isolate;white-space:nowrap}
  .hl::before{content:'';position:absolute;z-index:-1;left:-.18em;right:-.18em;bottom:-.04em;height:.7em;background:${C.mark};
    -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60' preserveAspectRatio='none'%3E%3Cpath d='M6 40C34 14 62 52 98 30S162 48 202 24S264 42 294 16' fill='none' stroke='%23000' stroke-width='28' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M10 48C62 30 122 54 182 38S262 46 292 30' fill='none' stroke='%23000' stroke-width='15' stroke-linecap='round' opacity='.72'/%3E%3Cpath d='M16 22C70 36 130 14 190 28S262 18 288 30' fill='none' stroke='%23000' stroke-width='9' stroke-linecap='round' opacity='.5'/%3E%3C/svg%3E") center/100% 100% no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60' preserveAspectRatio='none'%3E%3Cpath d='M6 40C34 14 62 52 98 30S162 48 202 24S264 42 294 16' fill='none' stroke='%23000' stroke-width='28' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M10 48C62 30 122 54 182 38S262 46 292 30' fill='none' stroke='%23000' stroke-width='15' stroke-linecap='round' opacity='.72'/%3E%3Cpath d='M16 22C70 36 130 14 190 28S262 18 288 30' fill='none' stroke='%23000' stroke-width='9' stroke-linecap='round' opacity='.5'/%3E%3C/svg%3E") center/100% 100% no-repeat}
</style>
${body}`

const lede = 'A speed dial and dashboard for Chrome. Free, open source and no account needed.'

const tiles = [
  {
    name: 'og-1200x630',
    w: 1200,
    h: 630,
    out: '../site/img/og.png',
    body: `<div style="padding:64px 80px 0;display:flex;flex-direction:column;gap:22px;width:100%">
      ${brand(44, 28)}
      ${headline(66, 'max-width:15ch')}
      <div style="font-size:21px;line-height:1.5;max-width:46ch">${lede}</div>
      <div style="margin-top:12px;width:880px">${frame(shot, 'border-bottom:0;border-radius:16px 16px 0 0;padding-bottom:0')}</div>
    </div>`,
  },
  {
    name: 'small-tile-440x280',
    w: 440,
    h: 280,
    body: `<div style="padding:34px 36px;display:flex;flex-direction:column;justify-content:space-between;width:100%">
      ${brand(34, 22)}
      ${headline(35, 'max-width:13ch')}
      <div style="font:500 22px 'Caveat',cursive;color:${C.accent}">Free and open source</div>
    </div>`,
  },
  {
    name: 'marquee-1400x560',
    w: 1400,
    h: 560,
    body: `<div style="display:flex;align-items:center;width:100%;gap:56px;padding-left:84px">
      <div style="display:flex;flex-direction:column;gap:24px;flex:none;width:560px">
        ${brand(46, 30)}
        ${headline(62)}
        <div style="font-size:19px;line-height:1.55;max-width:42ch">${lede}</div>
        <div style="font:500 24px 'Caveat',cursive;color:${C.accent}">No analytics. Permissions only when a widget needs one.</div>
      </div>
      <div style="flex:1;align-self:stretch;position:relative;overflow:hidden">
        <div style="position:absolute;top:50%;left:0;width:760px;transform:translateY(-50%)">
          ${frame(shot, 'border-right:0;border-radius:16px 0 0 16px')}
        </div>
      </div>
    </div>`,
  },
]

const browser = await chromium.launch()
for (const tile of tiles) {
  const ctx = await browser.newContext({ viewport: { width: tile.w, height: tile.h }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.setContent(page(tile.w, tile.h, tile.body), { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  const out = tile.out ? resolve(outDir, tile.out) : join(outDir, `${tile.name}.png`)
  await p.screenshot({ path: out })
  console.log(out.replace(process.cwd() + '/', ''))
  await ctx.close()
}
await browser.close()
