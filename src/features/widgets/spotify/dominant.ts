/**
 * The dominant colour of a piece of cover art, for the backdrop behind it.
 *
 * Spotify's CDN sends `access-control-allow-origin: *`, so the image can be
 * drawn to a canvas and read back. Anything else - a cross-origin failure, a
 * decode error - resolves to `null` and the caller keeps its plain background.
 */

// Sampling a thumbnail rather than the full 640px art: the dominant colour of a
// 32px reduction is the same, and the draw is ~400x cheaper.
const SIZE = 32

// Near-black and near-white pixels are usually letterboxing or a plain border,
// not the colour the art reads as, so they do not vote.
const MIN_SUM = 40 * 3
const MAX_SUM = 235 * 3

const cache = new Map<string, string | null>()

/**
 * Averages the art's pixels, weighted towards saturated ones so a colourful
 * subject wins over a large grey field. Returns an `rgb()` string, or `null`
 * when the art cannot be read.
 */
export async function dominantColor(url: string): Promise<string | null> {
  const hit = cache.get(url)
  if (hit !== undefined) return hit

  const color = await sample(url).catch(() => null)
  cache.set(url, color)
  return color
}

async function sample(url: string): Promise<string | null> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = url

  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(image, 0, 0, SIZE, SIZE)
  // Throws on a tainted canvas, which the caller turns into `null`.
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

  let r = 0
  let g = 0
  let b = 0
  let total = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue

    const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]]
    const sum = pr + pg + pb
    if (sum < MIN_SUM || sum > MAX_SUM) continue

    // Saturation as the vote's weight: the gap between the channels, so a grey
    // pixel counts for almost nothing and a vivid one dominates. The +1 keeps
    // fully grey art from summing to zero and yielding no colour at all.
    const weight = Math.max(pr, pg, pb) - Math.min(pr, pg, pb) + 1
    r += pr * weight
    g += pg * weight
    b += pb * weight
    total += weight
  }

  if (total === 0) return null
  return `rgb(${Math.round(r / total)} ${Math.round(g / total)} ${Math.round(b / total)})`
}
