/**
 * Draws a plain stock-style new tab (no logos) as the "before" half of the site's hero comparison.
 * Same 1280x800 frame as the wallpaper scene, so the two line up under the slider.
 *
 *   node scripts/gen-stock-tab.mjs
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../marketing/site/img/before@2x.png')

const shortcuts = ['Mail', 'Docs', 'News', 'Maps', 'Video', 'Shop', 'Chat', 'Notes', 'Photos']
const circles = shortcuts
  .map((name) => `<div class="s"><i>${name[0]}</i><span>${name}</span></div>`)
  .join('')

const html = `<body style="margin:0;background:#202124;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#e8eaed">
<style>
  .wrap{height:800px;display:flex;flex-direction:column;align-items:center;padding-top:300px;box-sizing:border-box}
  .bar{width:580px;height:48px;border-radius:24px;background:#303134;display:flex;align-items:center;gap:14px;padding:0 20px;box-sizing:border-box;color:#9aa0a6;font-size:16px}
  .grid{display:grid;grid-template-columns:repeat(5,112px);gap:20px 0;margin-top:44px}
  .s{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:12px;color:#bdc1c6}
  .s i{width:48px;height:48px;border-radius:50%;background:#3c4043;display:grid;place-items:center;font:500 20px sans-serif;color:#e8eaed;font-style:normal}
  .s.add i{background:#303134;color:#9aa0a6}
  .custom{position:absolute;right:28px;bottom:24px;height:36px;border-radius:18px;background:#303134;display:flex;align-items:center;padding:0 16px;font-size:13px;color:#8ab4f8}
</style>
<div class="wrap">
  <div class="bar"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#9aa0a6" stroke-width="2"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>Search or type a URL</div>
  <div class="grid">${circles}<div class="s add"><i>+</i><span>Add shortcut</span></div></div>
</div>
<div class="custom">Customise</div></body>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
await page.setContent(html)
await page.screenshot({ path: out })
await browser.close()
console.log(out.replace(process.cwd() + '/', ''))
