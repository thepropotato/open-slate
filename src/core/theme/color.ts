/** Small colour helpers: parsing, contrast, and sampling an accent from media. */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb | null {
  let value = hex.trim().replace('#', '')
  if (value.length === 3) value = value.split('').map((c) => c + c).join('')
  if (value.length === 8) value = value.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null
  const n = Number.parseInt(value, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export const rgbToHex = ({ r, g, b }: Rgb): string =>
  '#' + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')

const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Picks black or white text for a background, whichever reads better. */
export function readableOn(background: string): string {
  const rgb = hexToRgb(background)
  if (!rgb) return '#ffffff'
  return luminance(rgb) > 0.42 ? '#0b0d12' : '#ffffff'
}

export const isDark = (hex: string): boolean => {
  const rgb = hexToRgb(hex)
  return rgb ? luminance(rgb) < 0.42 : true
}

export function mix(a: string, b: string, amount: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  if (!x || !y) return a
  return rgbToHex({
    r: x.r + (y.r - x.r) * amount,
    g: x.g + (y.g - x.g) * amount,
    b: x.b + (y.b - x.b) * amount,
  })
}

/** Nudges a colour until it has usable contrast against `against`. */
export function ensureContrast(color: string, against: string, ratio = 3.2): string {
  const target = hexToRgb(against)
  const start = hexToRgb(color)
  if (!target || !start) return color
  const towards = luminance(target) > 0.42 ? '#000000' : '#ffffff'
  let result = color
  for (let step = 0; step <= 10; step += 1) {
    const candidate = mix(color, towards, step / 10)
    result = candidate
    const rgb = hexToRgb(candidate)
    if (rgb && contrast(rgb, target) >= ratio) break
  }
  return result
}

/** Reduces an image to one vivid colour, scoring by saturation so a grey photo still yields its colourful region. */
export async function dominantColor(src: string, allowCrossOrigin = false): Promise<string | null> {
  // Reading back a cross-origin image needs CORS headers the source may not send;
  // trying anyway costs a failed fetch and a console error.
  if (!allowCrossOrigin && !isReadable(src)) return null
  try {
    const bitmap = await loadBitmap(src)
    const colour = sampleDominant(bitmap)
    bitmap.close()
    return colour
  } catch {
    return null
  }
}

/** Same sampling, for something already drawable — a `<video>`, say. */
export function dominantColorOf(source: CanvasImageSource): string | null {
  try {
    return sampleDominant(source)
  } catch {
    return null
  }
}

function sampleDominant(source: CanvasImageSource): string | null {
  const size = 32
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  let best = { score: -1, rgb: { r: 0, g: 0, b: 0 } }
  let sum = { r: 0, g: 0, b: 0, n: 0 }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] }
    const max = Math.max(rgb.r, rgb.g, rgb.b)
    const min = Math.min(rgb.r, rgb.g, rgb.b)
    const saturation = max === 0 ? 0 : (max - min) / max
    // Favour saturated mid-tones over blown-out highlights and shadows.
    const score = saturation * (1 - Math.abs(max / 255 - 0.62))
    if (score > best.score) best = { score, rgb }
    sum = { r: sum.r + rgb.r, g: sum.g + rgb.g, b: sum.b + rgb.b, n: sum.n + 1 }
  }

  if (best.score > 0.12) return rgbToHex(best.rgb)
  if (sum.n === 0) return null
  return rgbToHex({ r: sum.r / sum.n, g: sum.g / sum.n, b: sum.b / sum.n })
}

/** True for blob:, data: and same-origin URLs, whose pixels are always readable. */
function isReadable(src: string): boolean {
  if (/^(blob:|data:)/.test(src)) return true
  try {
    return new URL(src, location.href).origin === location.origin
  } catch {
    return false
  }
}

async function loadBitmap(src: string): Promise<ImageBitmap> {
  const response = await fetch(src)
  return createImageBitmap(await response.blob())
}
