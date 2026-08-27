/**
 * Generates the extension's PNG icons with no image dependencies.
 *
 * The mark is a speed-dial motif: a rounded dark plate holding a 2x2 grid of
 * tiles with one accented. Drawn by maths into a raw RGBA buffer and encoded
 * as PNG via zlib, so the build stays dependency-free and byte-reproducible.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/icons')

const PLATE = [17, 20, 27]
const TILE = [232, 236, 244]
const ACCENT = [110, 168, 254]

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

function draw(size) {
  const ss = 3 // supersample factor
  const rgba = Buffer.alloc(size * size * 4)
  const plateHalf = size * 0.5
  const plateRadius = size * 0.24
  const inset = size * 0.19
  const cellGap = size * 0.085
  const cellSize = (size - inset * 2 - cellGap) / 2
  const cellRadius = cellSize * 0.28

  const cells = [0, 1].flatMap((row) =>
    [0, 1].map((col) => ({
      cx: inset + cellSize / 2 + col * (cellSize + cellGap),
      cy: inset + cellSize / 2 + row * (cellSize + cellGap),
      color: row === 1 && col === 1 ? ACCENT : TILE,
    })),
  )

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
              const d = roundedRectDistance(px, py, cell.cx, cell.cy, cellSize / 2, cellSize / 2, cellRadius)
              if (d < 0) {
                color = cell.color
                break
              }
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
