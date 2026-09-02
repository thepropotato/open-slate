/**
 * Generates the album art the Spotify scene renders.
 *
 * The widget's backdrop is sampled from the cover with `dominantColor`, and its
 * layout only reads correctly over art with a real subject, so a flat swatch
 * would undersell it. Drawing one keeps the capture reproducible from a clean
 * checkout and avoids putting a real album's artwork - someone else's
 * copyright - into a repo and onto a store listing.
 *
 * Raw RGBA encoded with zlib, matching `gen-wallpaper.mjs`: no image
 * dependency, byte-reproducible on any machine.
 *
 *   node scripts/gen-cover.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SIZE = 640

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 1
    const row = y * stride
    const at = y * (stride + 1) + 1
    for (let x = 0; x < stride; x += 1) {
      raw[at + x] = (rgb[row + x] - (x >= 3 ? rgb[row + x - 3] : 0)) & 0xff
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, t) => a + (b - a) * t

/**
 * A dusk gradient with a low sun and a horizon band.
 *
 * Saturated enough that `dominantColor` returns a warm accent rather than the
 * muddy average a low-contrast cover would give, which is the whole reason the
 * backdrop is worth showing.
 */
function draw() {
  const rgb = Buffer.alloc(SIZE * SIZE * 3)
  const sunX = SIZE * 0.5
  const sunY = SIZE * 0.62
  const sunR = SIZE * 0.17

  for (let y = 0; y < SIZE; y += 1) {
    const t = y / (SIZE - 1)
    // Deep indigo at the top easing into a warm band near the horizon.
    let r = lerp(28, 232, Math.pow(t, 2.1))
    let g = lerp(22, 108, Math.pow(t, 2.4))
    let b = lerp(58, 72, Math.pow(t, 3.0))

    for (let x = 0; x < SIZE; x += 1) {
      let rr = r
      let gg = g
      let bb = b

      // The sun disc, with a soft edge so it reads as light rather than a decal.
      const d = Math.hypot(x - sunX, y - sunY) / sunR
      if (d < 1.35) {
        const k = clamp01(1 - (d - 0.72) / 0.63)
        rr = lerp(rr, 255, k)
        gg = lerp(gg, 214, k)
        bb = lerp(bb, 150, k)
      }

      // A darker ridge across the lower third, giving the art a subject edge.
      const ridge = SIZE * 0.74 + Math.sin((x / SIZE) * Math.PI * 2.4) * SIZE * 0.035
      if (y > ridge) {
        const k = clamp01((y - ridge) / (SIZE * 0.1))
        rr = lerp(rr, 24, k * 0.94)
        gg = lerp(gg, 18, k * 0.94)
        bb = lerp(bb, 42, k * 0.94)
      }

      const at = (y * SIZE + x) * 3
      rgb[at] = Math.round(clamp01(rr / 255) * 255)
      rgb[at + 1] = Math.round(clamp01(gg / 255) * 255)
      rgb[at + 2] = Math.round(clamp01(bb / 255) * 255)
    }
  }
  return rgb
}

const out = resolve('marketing/assets/cover.png')
mkdirSync(dirname(out), { recursive: true })
const png = encodePng(SIZE, SIZE, draw())
writeFileSync(out, png)
console.log(`marketing/assets/cover.png  ${SIZE}x${SIZE}  ${Math.round(png.length / 1024)}KB`)
