/**
 * Draws the built-in wallpapers: layered ridgelines under a low sun or moon, with pen
 * outlines, hatching and a dot grid. Seeded, so output is stable. Writes JPEGs and
 * thumbnails to public/wallpapers, plus the PNG the marketing shots sit on.
 *
 *   node scripts/gen-wallpaper.mjs
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/wallpapers')
const marketingFile = resolve(here, '../marketing/assets/wallpaper.png')

const W = 2560
const H = 1600

const THEMES = {
  dawn: {
    seed: 7,
    sky: ['#10302A', '#25594C', '#7FB89B', '#EDE2A4', '#F6D56B'],
    sun: ['#FFF8D2', '#F6D55C'], sunStroke: '#7A5A10', glow: '#FFF1A8', line: '#FFF6D6',
    ridges: ['#8DBFA2', '#5C9A81', '#3A7562', '#25544A', '#15352F'], ink: '#07201B', stars: 0.6,
  },
  dusk: {
    seed: 21,
    sky: ['#1B1838', '#4F3469', '#C9667F', '#F2A97A', '#FBD38D'],
    sun: ['#FFF0CC', '#FFC66B'], sunStroke: '#8A4B14', glow: '#FFD9A0', line: '#FFE9CC',
    ridges: ['#8A5A8C', '#6A4577', '#4C3262', '#33224B', '#1F1433'], ink: '#140C24', stars: 0.5,
  },
  night: {
    seed: 33,
    sky: ['#060A1C', '#0F1F4A', '#2A4F8E', '#6C8FC4', '#B7CDE8'],
    sun: ['#FFFDF0', '#DCE4F2'], sunStroke: '#4C5F82', glow: '#CFE0FF', line: '#DCE8FF',
    ridges: ['#3A5E96', '#294674', '#1B325A', '#12233F', '#0A152B'], ink: '#050A18', stars: 0.9,
  },
  mist: {
    seed: 45,
    sky: ['#C5DDD2', '#DCEBDD', '#F1EFD2', '#FAE9B2', '#F8D96B'],
    sun: ['#FFF6CC', '#F8D96B'], sunStroke: '#9A7A12', glow: '#FFF3B8', line: '#FFFFFF',
    ridges: ['#BCD6C5', '#9CC0AB', '#7CA891', '#5E8D78', '#447360'], ink: '#27463A', stars: 0,
  },
}

function draw(theme) {
  let seed = theme.seed
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const ridge = (base, amp, bands) => {
    const waves = Array.from({ length: bands }, (_, i) => ({
      f: ((1 + i * 1.7) / W) * Math.PI * 2,
      a: amp / (1 + i * 1.3),
      p: rand() * Math.PI * 2,
    }))
    const points = []
    for (let x = -40; x <= W + 40; x += 16) {
      points.push([x, base - waves.reduce((sum, w) => sum + w.a * Math.sin(w.f * x + w.p), 0)])
    }
    const top = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`).join('')
    return { top, fill: `${top}L${W + 40} ${H + 40}L-40 ${H + 40}Z`, minY: Math.min(...points.map((p) => p[1])) }
  }

  const specs = [
    [950, 120, 4],
    [1040, 150, 5],
    [1150, 170, 5],
    [1270, 150, 4],
    [1400, 110, 4],
  ]
  const layers = specs.map(([base, amp, bands], i) => ({ color: theme.ridges[i], ...ridge(base, amp, bands) }))

  const stars = Array.from({ length: 70 }, () => {
    const x = rand() * W
    const y = rand() * 520
    return theme.stars
      ? `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + rand() * 2).toFixed(1)}" fill="${theme.line}" opacity="${(rand() * theme.stars).toFixed(2)}"/>`
      : ''
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

  const stops = theme.sky
    .map((color, i) => `<stop offset="${[0, 0.3, 0.5, 0.6, 0.68][i]}" stop-color="${color}"/>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
  <radialGradient id="sun"><stop offset="0" stop-color="${theme.sun[0]}"/><stop offset="1" stop-color="${theme.sun[1]}"/></radialGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="${theme.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${theme.glow}" stop-opacity="0"/></radialGradient>
  <pattern id="lines" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
    <line x1="0" y1="0" x2="0" y2="16" stroke="${theme.ink}" stroke-width="2.4" opacity=".5"/></pattern>
  <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.7" fill="${theme.line}" opacity=".26"/></pattern>
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
<g filter="url(#wobble)" fill="none" stroke="${theme.line}" stroke-width="3" opacity=".5">
  <circle cx="1760" cy="860" r="250"/><circle cx="1760" cy="860" r="330" opacity=".6"/><circle cx="1760" cy="860" r="420" opacity=".35"/></g>
<circle cx="1760" cy="860" r="180" fill="url(#sun)"/>
<g filter="url(#wobble)"><circle cx="1760" cy="860" r="180" fill="none" stroke="${theme.sunStroke}" stroke-width="3" opacity=".45"/></g>
${layers
  .map(
    (l, i) => `<g filter="url(#wobble)">
  <path d="${l.fill}" fill="${l.color}"/>
  <g clip-path="url(#c${i})" mask="url(#m${i})"><rect width="${W}" height="${H}" fill="url(#lines)"/></g>
  <path d="${l.top}" fill="none" stroke="${theme.ink}" stroke-width="3.2" opacity=".6"/>
  <path d="${l.top}" transform="translate(0 7)" fill="none" stroke="${theme.ink}" stroke-width="2" opacity=".22"/></g>`,
  )
  .join('\n')}
<rect width="${W}" height="${H}" fill="url(#dots)"/>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".5"/>
</svg>`
}


/* ---------------------------------------------------------------- other scenes */

// Shared across the scenes below: the pen wobble, dot grid, hatching and paper grain.
const shared = (ink, line, dotOpacity = 0.26) => `
  <pattern id="lines" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
    <line x1="0" y1="0" x2="0" y2="16" stroke="${ink}" stroke-width="2.4" opacity=".5"/></pattern>
  <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.7" fill="${line}" opacity="${dotOpacity}"/></pattern>
  <filter id="wobble" x="-2%" y="-2%" width="104%" height="104%">
    <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7"/></filter>
  <filter id="blur" filterUnits="userSpaceOnUse" x="-300" y="-300" width="${W + 600}" height="${H + 600}"><feGaussianBlur stdDeviation="38"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="9"/>
    <feColorMatrix values="0 0 0 0 .1  0 0 0 0 .12  0 0 0 0 .1  0 0 0 .55 0"/></filter>`

const frame = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${defs}</defs>
${body}
<rect width="${W}" height="${H}" fill="url(#dots)"/>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".5"/>
</svg>`

const rng = (seed) => {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const smooth = (base, amp, bands, rand, step = 16) => {
  const waves = Array.from({ length: bands }, (_, i) => ({
    f: ((1 + i * 1.7) / W) * Math.PI * 2,
    a: amp / (1 + i * 1.3),
    p: rand() * Math.PI * 2,
  }))
  const points = []
  for (let x = -40; x <= W + 40; x += step) {
    points.push([x, base - waves.reduce((sum, w) => sum + w.a * Math.sin(w.f * x + w.p), 0)])
  }
  const top = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`).join('')
  return { top, fill: `${top}L${W + 40} ${H + 40}L-40 ${H + 40}Z`, minY: Math.min(...points.map((p) => p[1])) }
}

// A filled shape with a pen outline, hatching that fades downward, and a loose second stroke.
const inked = (id, shape, color, ink, minY) => `
  <linearGradient id="f${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${minY}" x2="0" y2="${minY + 340}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
  <mask id="m${id}"><rect width="${W}" height="${H}" fill="url(#f${id})"/></mask>
  <clipPath id="c${id}"><path d="${shape.fill}"/></clipPath>`

const layerBody = (id, shape, color, ink) => `<g filter="url(#wobble)">
  <path d="${shape.fill}" fill="${color}"/>
  <g clip-path="url(#c${id})" mask="url(#m${id})"><rect width="${W}" height="${H}" fill="url(#lines)"/></g>
  <path d="${shape.top}" fill="none" stroke="${ink}" stroke-width="3.2" opacity=".6"/>
  <path d="${shape.top}" transform="translate(0 7)" fill="none" stroke="${ink}" stroke-width="2" opacity=".22"/></g>`

const stars = (count, rand, maxY, color, strength = 0.8) =>
  Array.from({ length: count }, () => {
    const x = rand() * W
    const y = rand() * maxY
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + rand() * 2.2).toFixed(1)}" fill="${color}" opacity="${(0.2 + rand() * strength).toFixed(2)}"/>`
  }).join('')

const stops = (list) => list.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join('')

const pine = (x, base, height, color, ink) => {
  const w = height * 0.28
  const tier = (top, bottom, width) => `${x} ${top} L${x + width} ${bottom} L${x - width} ${bottom} Z`
  const d = `M${tier(base - height, base - height * 0.55, w * 0.55)} M${tier(base - height * 0.78, base - height * 0.25, w * 0.8)} M${tier(base - height * 0.5, base, w)}`
  return `<path d="${d}" fill="${color}" stroke="${ink}" stroke-width="2" stroke-linejoin="round" opacity=".95"/>`
}

const SCENES = {
  aurora() {
    const rand = rng(51)
    const ridges = [
      [1080, 90, 3, '#1C3F63'],
      [1190, 110, 4, '#132C4A'],
      [1310, 90, 3, '#0B1D36'],
    ].map(([base, amp, bands, color], i) => ({ ...smooth(base, amp, bands, rand), color, id: `a${i}` }))
    const trees = (base, count, lo, hi, color) =>
      Array.from({ length: count }, () => pine(rand() * W, base + rand() * 50, lo + rand() * (hi - lo), color, '#030912')).join('')
    const band = (y, amp, color, width) => {
      const phase = rand() * 6
      const d = Array.from({ length: 80 }, (_, i) => {
        const x = (i / 79) * (W + 200) - 100
        return `${i ? 'L' : 'M'}${x.toFixed(0)} ${(y + amp * Math.sin(x / 330 + phase) + amp * 0.4 * Math.sin(x / 120 + phase * 2)).toFixed(0)}`
      }).join('')
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" filter="url(#blur)" opacity=".55"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
    }
    const defs = shared('#030912', '#BFE9FF') + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#04091A'], [0.45, '#0A2240'], [0.75, '#123B52'], [1, '#1A5560']])}</linearGradient>` + ridges.map((r) => inked(r.id, r, r.color, '#030912', r.minY)).join('')
    return frame(
      defs,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>${stars(190, rand, 760, '#E8F4FF')}
${band(420, 80, '#5CFFB0', 150)}${band(560, 70, '#4DE2E8', 120)}${band(330, 60, '#9B6BFF', 100)}
<circle cx="470" cy="300" r="68" fill="#EAF2FF"/><g filter="url(#wobble)"><circle cx="470" cy="300" r="68" fill="none" stroke="#7B8DB0" stroke-width="3" opacity=".6"/></g>
${ridges.map((r) => layerBody(r.id, r, r.color, '#030912')).join('\n')}
${trees(1290, 46, 150, 300, '#07182B')}${trees(1420, 30, 220, 420, '#040E1C')}
<rect y="1500" width="${W}" height="120" fill="#030912"/>`,
    )
  },

  tide() {
    const rand = rng(63)
    const horizon = 880
    const rows = Array.from({ length: 26 }, (_, r) => {
      const y = horizon + 14 + r ** 1.5 * 8
      const amp = 4 + r * 1.3
      const wl = 90 + r * 18
      const phase = rand() * 6
      const d = Array.from({ length: 70 }, (_, i) => {
        const x = (i / 69) * (W + 100) - 50
        return `${i ? 'L' : 'M'}${x.toFixed(0)} ${(y + amp * Math.sin(x / wl + phase)).toFixed(1)}`
      }).join('')
      return `<path d="${d}" fill="none" stroke="${r % 2 ? '#FFFFFF' : '#06232F'}" stroke-width="${2 + r * 0.12}" opacity="${r % 2 ? 0.2 : 0.28}"/>`
    }).join('')
    const glint = Array.from({ length: 20 }, (_, i) => {
      const y = horizon + 22 + i ** 1.4 * 9
      const w = 260 - i * 11 + rand() * 40
      return `<rect x="${1500 - w / 2}" y="${y}" width="${w}" height="${5 + i * 0.3}" rx="3" fill="#FFF0B8" opacity="${0.8 - i * 0.03}"/>`
    }).join('')
    const defs = shared('#06232F', '#FFF1CC') + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#31507A'], [0.35, '#8FB1C4'], [0.5, '#F2D3A4'], [0.55, '#FBE6BC']])}</linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#4A97A3'], [0.5, '#1D6678'], [1, '#082D3E']])}</linearGradient>
<clipPath id="above"><rect width="${W}" height="${horizon}"/></clipPath>`
    return frame(
      defs,
      `<rect width="${W}" height="${horizon + 6}" fill="url(#sky)"/>
<g clip-path="url(#above)"><circle cx="1500" cy="${horizon}" r="190" fill="#FFE9A8"/><g filter="url(#wobble)"><circle cx="1500" cy="${horizon}" r="190" fill="none" stroke="#9A7420" stroke-width="3" opacity=".45"/><circle cx="1500" cy="${horizon}" r="270" fill="none" stroke="#FFF6D6" stroke-width="3" opacity=".4"/><circle cx="1500" cy="${horizon}" r="360" fill="none" stroke="#FFF6D6" stroke-width="3" opacity=".25"/></g></g>
<g filter="url(#wobble)" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".6"><path d="M300 330h360M380 380h280M1750 250h330M1820 300h220"/></g>
<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#sea)"/>
<g filter="url(#wobble)">${rows}</g>${glint}
<g filter="url(#wobble)"><path d="M760 ${horizon + 24} L760 ${horizon - 110} L860 ${horizon + 20} Z" fill="#FFF6E2" stroke="#06232F" stroke-width="3"/><path d="M745 ${horizon + 28} L880 ${horizon + 28} L850 ${horizon + 56} L775 ${horizon + 56} Z" fill="#7A3E2B" stroke="#06232F" stroke-width="3"/></g>
<line x1="${W * 0.1}" y1="${horizon}" x2="${W * 0.9}" y2="${horizon}" stroke="#06232F" stroke-width="3" opacity=".35"/>`,
    )
  },

  skyline() {
    const rand = rng(77)
    const row = (base, count, lo, hi, color, windows, ink) => {
      let x = -40
      let out = `<rect y="${base}" width="${W}" height="${H}" fill="${color}"/>`
      while (x < W + 40) {
        const w = 70 + rand() * 120
        const h = lo + rand() * (hi - lo)
        out += `<rect x="${x.toFixed(0)}" y="${base - h}" width="${w.toFixed(0)}" height="${h + 200}" fill="${color}" stroke="${ink}" stroke-width="2.5" opacity=".98"/>`
        if (rand() > 0.7) out += `<path d="M${x + w / 2} ${base - h}V${base - h - 60}" stroke="${ink}" stroke-width="3"/>`
        if (windows) {
          for (let wy = base - h + 24; wy < base - 20; wy += 34) {
            for (let wx = x + 14; wx < x + w - 18; wx += 26) {
              if (rand() < windows) out += `<rect x="${wx.toFixed(0)}" y="${wy}" width="11" height="15" rx="2" fill="#FFD27A" opacity="${(0.55 + rand() * 0.4).toFixed(2)}"/>`
            }
          }
        }
        x += w + rand() * 14
      }
      void count
      return out
    }
    const defs = shared('#0A0620', '#FFD9A8') + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#100B2B'], [0.35, '#3A1E5C'], [0.6, '#B34A7B'], [0.78, '#F59E6B']])}</linearGradient>`
    return frame(
      defs,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>${stars(90, rng(5), 560, '#FFF1DA', 0.7)}
<circle cx="1900" cy="430" r="135" fill="#FFE8C4"/><g filter="url(#wobble)"><circle cx="1900" cy="430" r="135" fill="none" stroke="#B8845A" stroke-width="3" opacity=".5"/><circle cx="1900" cy="430" r="215" fill="none" stroke="#FFE8C4" stroke-width="3" opacity=".25"/></g>
<g filter="url(#wobble)">${row(1180, 0, 150, 430, '#43306E', 0, '#0A0620')}${row(1330, 0, 220, 560, '#271A4B', 0.1, '#0A0620')}${row(1500, 0, 160, 440, '#130D2E', 0.28, '#0A0620')}</g>
<rect y="1560" width="${W}" height="80" fill="#0A0620"/>`,
    )
  },

  dunes() {
    const rand = rng(88)
    const layers = [
      [980, 70, 2, '#E8A06C'],
      [1080, 90, 2, '#D17A55'],
      [1200, 110, 3, '#A8523F'],
      [1330, 100, 2, '#6B2E33'],
      [1460, 80, 2, '#3A1A26'],
    ].map(([base, amp, bands, color], i) => ({ ...smooth(base, amp, bands, rand, 12), color, id: `d${i}` }))
    const ripples = Array.from({ length: 7 }, (_, i) => {
      const y = 1250 + i * 38
      const d = Array.from({ length: 50 }, (_, k) => `${k ? 'L' : 'M'}${(k / 49) * W} ${(y + 18 * Math.sin(k / 3 + i)).toFixed(0)}`).join('')
      return `<path d="${d}" fill="none" stroke="#2A1118" stroke-width="3" opacity=".22"/>`
    }).join('')
    const defs = shared('#2A1118', '#FFE6C0') + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#2F2250'], [0.3, '#8A4B6E'], [0.52, '#E9906A'], [0.66, '#F8D79A']])}</linearGradient>` + layers.map((l) => inked(l.id, l, l.color, '#2A1118', l.minY)).join('')
    return frame(
      defs,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>${stars(60, rand, 420, '#FFEBD2', 0.5)}
<circle cx="1000" cy="560" r="160" fill="#FFF1D2"/><g filter="url(#wobble)"><circle cx="1000" cy="560" r="160" fill="none" stroke="#B88454" stroke-width="3" opacity=".5"/><circle cx="1000" cy="560" r="250" fill="none" stroke="#FFF1D2" stroke-width="3" opacity=".3"/></g>
${layers.map((l) => layerBody(l.id, l, l.color, '#2A1118')).join('\n')}<g filter="url(#wobble)">${ripples}</g>`,
    )
  },

  pines() {
    const rand = rng(99)
    const rows = [
      [900, 70, 150, '#A8CBB8', 70, 0.0],
      [1000, 100, 210, '#7FAE98', 56, 0.0],
      [1110, 130, 280, '#559078', 46, 0.0],
      [1240, 170, 370, '#33705A', 36, 0.0],
      [1400, 220, 470, '#1B4A3A', 28, 0.0],
    ]
    const forest = rows
      .map(([base, lo, hi, color, count], i) => {
        const trees = Array.from({ length: count }, () => pine(rand() * (W + 120) - 60, base + rand() * 40, lo + rand() * (hi - lo), color, i > 2 ? '#0A2119' : '#2C5A49')).join('')
        const mist = i < 4 ? `<rect y="${base - hi * 0.7}" width="${W}" height="${hi}" fill="url(#mist)"/>` : ''
        return `<g filter="url(#wobble)">${trees}<rect y="${base + 20}" width="${W}" height="${H}" fill="${color}"/></g>${mist}`
      })
      .join('')
    const defs = shared('#0A2119', '#FFFFFF', 0.3) + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#C8DDD3'], [0.4, '#E6EFD9'], [0.62, '#F6EBC0']])}</linearGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F8EE" stop-opacity="0"/><stop offset="1" stop-color="#F4F8EE" stop-opacity=".55"/></linearGradient>`
    return frame(
      defs,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="1650" cy="640" r="130" fill="#FFF3C2"/><g filter="url(#wobble)"><circle cx="1650" cy="640" r="130" fill="none" stroke="#A88A2A" stroke-width="3" opacity=".4"/><circle cx="1650" cy="640" r="210" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".5"/></g>
${forest}`,
    )
  },

  orbit() {
    const rand = rng(111)
    const stripes = ['#E9A06A', '#C46B5A', '#E7B07C', '#8E4A6B', '#D88A62', '#A5566A']
      .map((color, i) => `<rect x="1300" y="${420 + i * 130}" width="900" height="140" fill="${color}"/>`)
      .join('')
    const defs = shared('#080B22', '#C7D2FF') + `<linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">${stops([[0, '#0A0E2E'], [0.6, '#16184A'], [1, '#26205E']])}</linearGradient>
<clipPath id="planet"><circle cx="1750" cy="800" r="420"/></clipPath>
<clipPath id="front"><rect x="1100" y="800" width="1400" height="500"/></clipPath>
<clipPath id="back"><rect x="1100" y="300" width="1400" height="500"/></clipPath>`
    const ring = (rx, ry, opacity, color, width) =>
      `<ellipse cx="1750" cy="800" rx="${rx}" ry="${ry}" transform="rotate(-18 1750 800)" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`
    return frame(
      defs,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>${stars(240, rand, H, '#DDE5FF', 0.9)}
<g filter="url(#wobble)" fill="none" stroke="#C7D2FF" stroke-width="2.5" stroke-dasharray="4 14" opacity=".4"><ellipse cx="1750" cy="800" rx="930" ry="250" transform="rotate(-18 1750 800)"/></g>
<g filter="url(#wobble)"><g clip-path="url(#back)">${ring(640, 150, 0.8, '#E8C9A0', 26)}${ring(560, 126, 0.55, '#C99C78', 16)}</g>
<g clip-path="url(#planet)">${stripes}<rect x="1300" y="400" width="900" height="900" fill="url(#lines)" opacity=".55"/></g>
<circle cx="1750" cy="800" r="420" fill="none" stroke="#080B22" stroke-width="4" opacity=".7"/>
<g clip-path="url(#front)">${ring(640, 150, 0.9, '#F0D3A8', 26)}${ring(560, 126, 0.6, '#D3A67E', 16)}</g></g>
<circle cx="620" cy="460" r="95" fill="#E4E8F5"/><g filter="url(#wobble)"><circle cx="620" cy="460" r="95" fill="none" stroke="#6C759B" stroke-width="3"/><circle cx="590" cy="440" r="18" fill="#BCC4DD"/><circle cx="650" cy="490" r="12" fill="#BCC4DD"/><circle cx="635" cy="425" r="8" fill="#BCC4DD"/></g>
<circle cx="1080" cy="1200" r="42" fill="#5EC9C0"/><g filter="url(#wobble)"><circle cx="1080" cy="1200" r="42" fill="none" stroke="#0E3A44" stroke-width="3"/></g>
<g filter="url(#wobble)" stroke="#F5F7FF" stroke-width="4" stroke-linecap="round" opacity=".6"><path d="M330 1080L520 1030"/><path d="M2100 260L2230 230"/></g>`,
    )
  },

  contours() {
    const rand = rng(123)
    const field = (cx, cy, count, step, tint) => {
      const phases = [rand() * 6, rand() * 6, rand() * 6]
      return Array.from({ length: count }, (_, i) => {
        const r = (count - i) * step
        const d = Array.from({ length: 121 }, (_, k) => {
          const a = (k / 120) * Math.PI * 2
          const bump = 1 + 0.1 * Math.sin(3 * a + phases[0]) + 0.06 * Math.sin(5 * a + phases[1]) + 0.035 * Math.sin(8 * a + phases[2])
          return `${k ? 'L' : 'M'}${(cx + Math.cos(a) * r * bump * 1.25).toFixed(1)} ${(cy + Math.sin(a) * r * bump).toFixed(1)}`
        }).join('') + 'Z'
        return `<path d="${d}" fill="${tint[i % tint.length]}" stroke="#2F5D50" stroke-width="${i % 5 === 0 ? 4 : 2.4}" opacity="${i % 5 === 0 ? 0.7 : 0.45}"/>`
      }).join('')
    }
    const defs = shared('#2F5D50', '#2F5D50', 0.22)
    return frame(
      defs,
      `<rect width="${W}" height="${H}" fill="#E8EFE5"/>
<g filter="url(#wobble)">${field(700, 640, 16, 40, ['#E1EBDC', '#D6E4D1'])}${field(1800, 1020, 18, 42, ['#E1EBDC', '#D6E4D1'])}</g>
<g filter="url(#wobble)"><circle cx="1800" cy="1020" r="46" fill="#F2D95C" stroke="#2F5D50" stroke-width="3"/><circle cx="700" cy="640" r="34" fill="#F2D95C" stroke="#2F5D50" stroke-width="3"/></g>`,
    )
  },
}

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
const thumbs = await browser.newPage({ viewport: { width: 480, height: 300 } })

const jobs = [
  ...Object.entries(THEMES).map(([id, theme]) => [id, () => draw(theme)]),
  ...Object.entries(SCENES).map(([id, build]) => [id === 'skyline' ? 'skyline' : id, build]),
]

for (const [id, build] of jobs) {
  await page.setContent(`<body style="margin:0">${build()}</body>`)
  const full = await page.screenshot({ type: 'jpeg', quality: 78 })
  writeFileSync(resolve(outDir, `${id}.jpg`), full)
  await thumbs.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${full.toString('base64')}" width="480" height="300"></body>`)
  writeFileSync(resolve(outDir, `${id}-thumb.jpg`), await thumbs.screenshot({ type: 'jpeg', quality: 72 }))
  if (id === 'dawn') writeFileSync(marketingFile, await page.screenshot())
  console.log(`public/wallpapers/${id}.jpg`)
}
await browser.close()
