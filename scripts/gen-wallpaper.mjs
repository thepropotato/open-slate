/**
 * Generates the wallpaper the marketing shots sit on.
 *
 * The wallpaper scene has to prove the thing screenshots of a flat gradient
 * cannot: that panels stay readable over a real photograph, that dim, blur and
 * vignette are doing work, and that the accent really is sampled from the
 * image. A stock photo would do that - and would also drag a licence, a
 * download and a binary blob into a repo whose every other asset is generated.
 *
 * So it is drawn instead: a dusk sky, a sun, layered ridgelines going hazy with
 * distance, and a lake holding a rippled reflection. Enough structure that the
 * adjustment layers have something to bite on, and enough saturation in the
 * sun's band that `accentSource: 'wallpaper'` picks a warm accent rather than a
 * muddy average.
 *
 * Written straight into a raw RGBA buffer and encoded with zlib, matching
 * `gen-icons.mjs` - no image dependency, and byte-reproducible on any machine.
 *
 * The output lives in `marketing/assets/`, not in the site's `img/`: it is an
 * input to the capture, inlined into the page as a data URL, and the website
 * never serves the 3MB original.
 *
 *   node scripts/gen-wallpaper.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../marketing/assets/wallpaper.png')

/** 2560x1600 keeps it sharp behind a 2x 1280x800 shot without being huge. */
const WIDTH = 2560
const HEIGHT = 1600

/* ------------------------------------------------------------------ png */

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

/** Truecolour, no alpha: a wallpaper is opaque, and 24-bit keeps the file smaller. */
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    // Filter 1 (Sub) predicts each byte from its left neighbour, which is a far
    // better fit for smooth horizontal gradients than no filter at all.
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

/* --------------------------------------------------------------- colour */

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/** Smoothstep, for ridgeline edges and haze falloff that do not band. */
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/* ---------------------------------------------------------------- noise */

/**
 * Value noise with a fixed integer hash.
 *
 * Deliberately not `Math.random`: the whole point is that two machines running
 * this produce identical bytes, so every source of variation has to be seeded
 * and deterministic.
 */
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function valueNoise(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  return lerp(
    lerp(hash(xi, yi), hash(xi + 1, yi), u),
    lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u),
    v,
  )
}

/** Layered noise, used for both ridge silhouettes and water ripple. */
function fbm(x, y, octaves) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * freq, y * freq) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/* ---------------------------------------------------------------- scene */

const SKY_TOP = [26, 30, 58]
const SKY_MID = [86, 74, 122]
const SKY_WARM = [232, 150, 106]
const SUN = [255, 214, 148]

/** Where the water starts, as a fraction of the height. */
const HORIZON = 0.62
const SUN_X = 0.68
const SUN_Y = 0.5
const SUN_R = 0.052

/**
 * The ridges, far to near. Each is a silhouette whose height comes from noise,
 * and each sits closer to the foreground colour and further from the haze.
 */
const RIDGES = [
  { base: 0.5, amp: 0.055, freq: 1.6, seed: 11.5, colour: [104, 96, 138], haze: 0.72 },
  { base: 0.545, amp: 0.07, freq: 2.4, seed: 43.25, colour: [72, 64, 102], haze: 0.46 },
  { base: 0.6, amp: 0.085, freq: 3.1, seed: 77.75, colour: [44, 39, 68], haze: 0.22 },
]

/** The sky at a given height, before the sun is added. */
function skyAt(v) {
  // Warm band hugging the horizon, cool blue climbing away from it.
  const warmth = smooth(HORIZON, HORIZON - 0.34, v)
  const upper = mix(SKY_TOP, SKY_MID, smooth(0, HORIZON - 0.2, v))
  return mix(upper, SKY_WARM, warmth * 0.85)
}

/** Sky plus the sun's disc and its glow, at normalised coords. */
function skyWithSun(u, v) {
  let colour = skyAt(v)

  // Aspect-corrected so the sun is round rather than an ellipse.
  const aspect = WIDTH / HEIGHT
  const dx = (u - SUN_X) * aspect
  const dy = v - SUN_Y
  const dist = Math.hypot(dx, dy)

  // Glow first, then the disc over it.
  colour = mix(colour, SUN, 0.55 * Math.exp(-((dist / (SUN_R * 5.5)) ** 2)))
  colour = mix(colour, SUN, smooth(SUN_R, SUN_R * 0.82, dist))
  return colour
}

/** Ridge height at a horizontal position, as a normalised y. */
const ridgeHeight = (ridge, u) =>
  ridge.base - ridge.amp * (fbm(u * ridge.freq + ridge.seed, ridge.seed * 0.5, 5) - 0.5) * 2

function draw() {
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3)

  // Ridge silhouettes depend only on x, so they are computed once per column
  // rather than once per pixel - the difference is seconds on a 4MP image.
  const heights = RIDGES.map((ridge) =>
    Float64Array.from({ length: WIDTH }, (_, x) => ridgeHeight(ridge, x / WIDTH)),
  )

  for (let y = 0; y < HEIGHT; y += 1) {
    const v = y / HEIGHT
    for (let x = 0; x < WIDTH; x += 1) {
      const u = x / WIDTH
      let colour

      if (v < HORIZON) {
        colour = skyWithSun(u, v)
        // Near ridges paint over far ones, so walk far to near.
        for (let i = 0; i < RIDGES.length; i += 1) {
          const ridge = RIDGES[i]
          const cover = smooth(heights[i][x] - 0.0015, heights[i][x] + 0.0015, v)
          if (cover <= 0) continue
          // Distant ridges are washed toward the sky behind them, which is what
          // reads as depth; near ones keep their own colour.
          const tinted = mix(ridge.colour, skyAt(v), ridge.haze * 0.55)
          colour = mix(colour, tinted, cover)
        }
      } else {
        // Water: the sky mirrored about the horizon, compressed and rippled.
        const depth = (v - HORIZON) / (1 - HORIZON)
        const ripple = (fbm(u * 26, depth * 90 + 5.5, 3) - 0.5) * 0.02 * (0.25 + depth)
        const mirrored = HORIZON - depth * (HORIZON * 0.55) + ripple

        colour = skyWithSun(u, clamp01(mirrored))
        for (let i = 0; i < RIDGES.length; i += 1) {
          const ridge = RIDGES[i]
          const cover = smooth(heights[i][x] - 0.002, heights[i][x] + 0.002, clamp01(mirrored))
          if (cover > 0) {
            colour = mix(colour, mix(ridge.colour, skyAt(mirrored), ridge.haze * 0.55), cover)
          }
        }

        // Water is darker and bluer than what it reflects, more so with depth.
        colour = mix(colour, [18, 22, 44], 0.3 + depth * 0.45)

        // A specular path under the sun, breaking up as it nears the viewer.
        const glint = Math.exp(-(((u - SUN_X) / 0.075) ** 2)) * (1 - depth * 0.75)
        if (glint > 0.004) {
          const broken = smooth(0.42, 0.72, fbm(u * 42, depth * 130, 3))
          colour = mix(colour, SUN, clamp01(glint * broken * 0.85))
        }
      }

      // A little grain stops the wide gradients from banding once Chrome
      // scales the image, and survives the blur the scene applies.
      const grain = (hash(x, y) - 0.5) * 3.2
      const at = (y * WIDTH + x) * 3
      rgb[at] = clamp01((colour[0] + grain) / 255) * 255
      rgb[at + 1] = clamp01((colour[1] + grain) / 255) * 255
      rgb[at + 2] = clamp01((colour[2] + grain) / 255) * 255
    }
  }

  return rgb
}

mkdirSync(dirname(outFile), { recursive: true })
const png = encodePng(WIDTH, HEIGHT, draw())
writeFileSync(outFile, png)
console.log(
  `${outFile.replace(process.cwd() + '/', '')}  ${WIDTH}x${HEIGHT}  ${(png.length / 1024).toFixed(0)}KB`,
)
