/**
 * Generates the extension's PNG icons with no image dependencies.
 *
 * The mark is a speed-dial motif: a rounded dark plate holding a 2x2 grid of
 * tiles, the top-right one an empty slot drawn as a ring of dots. It is the
 * same mark as marketing/site/favicon.svg, in the same Paper & Ink palette,
 * with that file's 64-unit geometry scaled to each icon size.
 *
 * Drawn by maths into a raw RGBA buffer and encoded as PNG via zlib, so the
 * build stays dependency-free and byte-reproducible.
 *
 * The dots do not survive every size: below DOTS_MIN_SIZE a ring of them
 * blurs into a grey smear, so the small icons fill the slot faintly instead.
 * That keeps 16px legible in a toolbar, which is the only place it is ever
 * seen, at the cost of the two smallest icons being an approximation.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/icons')

// Paper & Ink, matching the site and marketing/site/favicon.svg.
const PLATE = [26, 25, 23] // #1A1917
const TILE = [250, 249, 246] // #FAF9F6

// The solid tiles are drawn at .9 alpha over the plate, as in the favicon.
const TILE_ALPHA = 0.9

/**
 * favicon.svg's geometry, as fractions of its 64-unit viewBox, so every icon
 * size is the same drawing scaled rather than a second set of numbers to keep
 * in step.
 */
const UNIT = 64
const PLATE_RADIUS = 15 / UNIT
const CELL_INSET = 11 / UNIT
const CELL_SIZE = 18 / UNIT
const CELL_GAP = 6 / UNIT
const CELL_RADIUS = 4 / 18 // of the cell, not the icon
const DOT_RADIUS = 1.25 / UNIT

/** Below this, the dot ring reads as a smudge and the slot is filled instead. */
const DOTS_MIN_SIZE = 48
const SLOT_FILL_ALPHA = 0.22

/**
 * The empty slot's dots, from favicon.svg, as viewBox coordinates. They are
 * placed explicitly rather than left to a stroke-dasharray: the count is a
 * multiple of four and the walk starts a half-step in, so all four sides match
 * and the corners land on the arc.
 */
const SLOT_DOTS = [
  [40.47, 12.25], [43.33, 12.25], [46.19, 12.25], [49.05, 12.25],
  [51.39, 13.67], [51.75, 16.47], [51.75, 19.33], [51.75, 22.19],
  [51.75, 25.05], [50.33, 27.39], [47.53, 27.75], [44.67, 27.75],
  [41.81, 27.75], [38.95, 27.75], [36.61, 26.33], [36.25, 23.53],
  [36.25, 20.67], [36.25, 17.81], [36.25, 14.95], [37.67, 12.61],
]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // no filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Signed distance to a rounded rectangle, used for antialiased edges. */
function roundedRectDistance(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius)
  const dy = Math.abs(py - cy) - (halfH - radius)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - radius
}

/** Signed distance to a circle, used for the slot's dots. */
function circleDistance(px, py, cx, cy, radius) {
  return Math.hypot(px - cx, py - cy) - radius
}

/** Lays `src` over `dst` at `alpha`, both opaque RGB triples. */
function over(dst, src, alpha) {
  return [
    dst[0] + (src[0] - dst[0]) * alpha,
    dst[1] + (src[1] - dst[1]) * alpha,
    dst[2] + (src[2] - dst[2]) * alpha,
  ]
}

function draw(size) {
  const ss = 3 // supersample factor
  const rgba = Buffer.alloc(size * size * 4)
  const plateHalf = size * 0.5
  const plateRadius = size * PLATE_RADIUS
  const inset = size * CELL_INSET
  const cellSize = size * CELL_SIZE
  const cellStride = cellSize + size * CELL_GAP
  const cellRadius = cellSize * CELL_RADIUS

  // Three solid tiles; the top-right cell is the empty slot.
  const cells = [0, 1]
    .flatMap((row) => [0, 1].map((col) => ({ row, col })))
    .filter(({ row, col }) => !(row === 0 && col === 1))
    .map(({ row, col }) => ({
      cx: inset + cellSize / 2 + col * cellStride,
      cy: inset + cellSize / 2 + row * cellStride,
    }))

  // The slot, either as the favicon's dot ring or - where that would smear -
  // as the same footprint filled faintly.
  const scale = size / UNIT
  const drawDots = size >= DOTS_MIN_SIZE
  const dots = SLOT_DOTS.map(([x, y]) => ({ cx: x * scale, cy: y * scale }))
  const dotRadius = size * DOT_RADIUS
  const slot = {
    cx: inset + cellSize / 2 + cellStride,
    cy: inset + cellSize / 2,
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let acc = [0, 0, 0, 0]
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x + (sx + 0.5) / ss
          const py = y + (sy + 0.5) / ss
          let color = [0, 0, 0]
          let alpha = 0

          if (roundedRectDistance(px, py, plateHalf, plateHalf, plateHalf, plateHalf, plateRadius) < 0) {
            color = PLATE
            alpha = 1

            for (const cell of cells) {
              if (roundedRectDistance(px, py, cell.cx, cell.cy, cellSize / 2, cellSize / 2, cellRadius) < 0) {
                color = over(color, TILE, TILE_ALPHA)
                break
              }
            }

            if (drawDots) {
              for (const dot of dots) {
                if (circleDistance(px, py, dot.cx, dot.cy, dotRadius) < 0) {
                  color = TILE
                  break
                }
              }
            } else if (
              roundedRectDistance(px, py, slot.cx, slot.cy, cellSize / 2, cellSize / 2, cellRadius) < 0
            ) {
              color = over(color, TILE, SLOT_FILL_ALPHA)
            }
          }
          acc = [acc[0] + color[0] * alpha, acc[1] + color[1] * alpha, acc[2] + color[2] * alpha, acc[3] + alpha]
        }
      }
      const samples = ss * ss
      const a = acc[3] / samples
      const i = (y * size + x) * 4
      rgba[i] = a > 0 ? Math.round(acc[0] / acc[3]) : 0
      rgba[i + 1] = a > 0 ? Math.round(acc[1] / acc[3]) : 0
      rgba[i + 2] = a > 0 ? Math.round(acc[2] / acc[3]) : 0
      rgba[i + 3] = Math.round(a * 255)
    }
  }
  return encodePng(size, size, rgba)
}

mkdirSync(outDir, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(outDir, `icon${size}.png`), draw(size))
  console.log(`icons/icon${size}.png`)
}
