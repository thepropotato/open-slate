/**
 * Draws the wallpaper the marketing shots sit on: layered ridgelines under a low sun,
 * with pen outlines, hatching and a dot grid to match the site. Seeded, so output is stable.
 *
 *   node scripts/gen-wallpaper.mjs
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../marketing/assets/wallpaper.png')

const W = 2560
const H = 1600

let seed = 7
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

// Sum of sines with random phases: smooth hills with a few sharper peaks.
const ridge = (base, amp, bands) => {
  const waves = Array.from({ length: bands }, (_, i) => ({
    f: (1 + i * 1.7) / W * Math.PI * 2,
    a: amp / (1 + i * 1.3),
    p: rand() * Math.PI * 2,
  }))
  const points = []
  for (let x = -40; x <= W + 40; x += 16) {
    const y = base - waves.reduce((sum, w) => sum + w.a * Math.sin(w.f * x + w.p), 0)
    points.push([x, y])
  }
  const top = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`).join('')
  return { top, fill: `${top}L${W + 40} ${H + 40}L-40 ${H + 40}Z`, minY: Math.min(...points.map((p) => p[1])) }
}

const layers = [
  { base: 950, amp: 120, bands: 4, color: '#8DBFA2' },
  { base: 1040, amp: 150, bands: 5, color: '#5C9A81' },
  { base: 1150, amp: 170, bands: 5, color: '#3A7562' },
  { base: 1270, amp: 150, bands: 4, color: '#25544A' },
  { base: 1400, amp: 110, bands: 4, color: '#15352F' },
].map((layer) => ({ ...layer, ...ridge(layer.base, layer.amp, layer.bands) }))

const stars = Array.from({ length: 70 }, () => {
  const x = rand() * W
  const y = rand() * 520
  return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + rand() * 2).toFixed(1)}" fill="#FFF6D6" opacity="${(0.25 + rand() * 0.5).toFixed(2)}"/>`
}).join('')

const hatch = layers
  .map(
    (l, i) => `
  <linearGradient id="fade${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${l.minY}" x2="0" y2="${l.minY + 340}">
    <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
  <mask id="m${i}"><rect width="${W}" height="${H}" fill="url(#fade${i})"/></mask>
  <clipPath id="c${i}"><path d="${l.fill}"/></clipPath>`,
  )
  .join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#10302A"/><stop offset=".3" stop-color="#25594C"/>
    <stop offset=".5" stop-color="#7FB89B"/><stop offset=".6" stop-color="#EDE2A4"/><stop offset=".68" stop-color="#F6D56B"/>
  </linearGradient>
  <radialGradient id="sun"><stop offset="0" stop-color="#FFF8D2"/><stop offset="1" stop-color="#F6D55C"/></radialGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#FFF1A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFF1A8" stop-opacity="0"/></radialGradient>
  <pattern id="lines" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
    <line x1="0" y1="0" x2="0" y2="16" stroke="#07201B" stroke-width="2.4" opacity=".5"/></pattern>
  <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.7" fill="#FFF6D6" opacity=".26"/></pattern>
  <filter id="wobble" x="-2%" y="-2%" width="104%" height="104%">
    <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="9"/>
    <feColorMatrix values="0 0 0 0 .1  0 0 0 0 .12  0 0 0 0 .1  0 0 0 .55 0"/></filter>
  ${hatch}
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars}
<circle cx="1760" cy="860" r="520" fill="url(#glow)"/>
<g filter="url(#wobble)" fill="none" stroke="#FFF6D6" stroke-width="3" opacity=".5">
  <circle cx="1760" cy="860" r="250"/><circle cx="1760" cy="860" r="330" opacity=".6"/><circle cx="1760" cy="860" r="420" opacity=".35"/></g>
<circle cx="1760" cy="860" r="180" fill="url(#sun)"/>
<g filter="url(#wobble)"><circle cx="1760" cy="860" r="180" fill="none" stroke="#7A5A10" stroke-width="3" opacity=".45"/></g>
${layers
  .map(
    (l, i) => `<g filter="url(#wobble)">
  <path d="${l.fill}" fill="${l.color}"/>
  <g clip-path="url(#c${i})" mask="url(#m${i})"><rect width="${W}" height="${H}" fill="url(#lines)"/></g>
  <path d="${l.top}" fill="none" stroke="#07201B" stroke-width="3.2" opacity=".6"/>
  <path d="${l.top}" transform="translate(0 7)" fill="none" stroke="#07201B" stroke-width="2" opacity=".22"/></g>`,
  )
  .join('\n')}
<rect width="${W}" height="${H}" fill="url(#dots)"/>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".5"/>
</svg>`

mkdirSync(dirname(outFile), { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
await page.setContent(`<body style="margin:0">${svg}</body>`)
await page.screenshot({ path: outFile })
await browser.close()
console.log(outFile.replace(process.cwd() + '/', ''))
