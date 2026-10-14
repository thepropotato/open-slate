/**
 * The fonts on offer. Each bundled face ships inside the extension (`fontFaces.css`), so a new
 * tab paints without waiting on a download. A Google font the user adds by name is the one
 * exception: it is fetched from Google Fonts once, when added or first used, and cached by the browser.
 */

export interface FontOption {
  id: string
  label: string
  stack: string
}

const SYSTEM = `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
const SERIF = `ui-serif, Georgia, 'Times New Roman', serif`
const MONO = `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`

export const fontOptions: FontOption[] = [
  { id: 'system', label: 'System', stack: SYSTEM },
  { id: 'brand', label: 'Bricolage Grotesque', stack: `'Bricolage Grotesque', ${SYSTEM}` },
  { id: 'inter', label: 'Inter', stack: `Inter, ${SYSTEM}` },
  { id: 'dm-sans', label: 'DM Sans', stack: `'DM Sans', ${SYSTEM}` },
  { id: 'manrope', label: 'Manrope', stack: `Manrope, ${SYSTEM}` },
  { id: 'space-grotesk', label: 'Space Grotesk', stack: `'Space Grotesk', ${SYSTEM}` },
  { id: 'rounded', label: 'Nunito', stack: `Nunito, ui-rounded, ${SYSTEM}` },
  { id: 'serif', label: 'Lora', stack: `Lora, ${SERIF}` },
  { id: 'playfair', label: 'Playfair Display', stack: `'Playfair Display', ${SERIF}` },
  { id: 'mono', label: 'JetBrains Mono', stack: `'JetBrains Mono', ${MONO}` },
  { id: 'fira-code', label: 'Fira Code', stack: `'Fira Code', ${MONO}` },
  { id: 'hand', label: 'Caveat', stack: `Caveat, 'Segoe Print', 'Bradley Hand', cursive` },
]

const GOOGLE = 'google:'

export const googleFontId = (name: string): string => `${GOOGLE}${name}`
export const googleFontName = (id: string): string | null => (id.startsWith(GOOGLE) ? id.slice(GOOGLE.length) : null)

/**
 * Pulls a family name out of whatever the user pasted: a plain name, a fonts.google.com
 * page address, or the css2 address Google gives for embedding. Null when nothing usable is there.
 */
export function parseGoogleFont(input: string): string | null {
  const text = input.trim()
  if (!text) return null

  let name = text
  if (/^https?:\/\//i.test(text)) {
    let url: URL
    try {
      url = new URL(text)
    } catch {
      return null
    }
    if (!/(^|\.)fonts\.(google|googleapis)\.com$/i.test(url.hostname)) return null
    const family = url.searchParams.get('family')
    const specimen = /\/specimen\/([^/?#]+)/i.exec(url.pathname)?.[1]
    const raw = family ?? specimen
    if (!raw) return null
    name = decodeURIComponent(raw.replace(/\+/g, ' '))
  }

  // `Open Sans:wght@400;700` keeps only the family.
  name = name.split(':')[0].replace(/\s+/g, ' ').trim()
  return /^[A-Za-z0-9][A-Za-z0-9 ]{0,59}$/.test(name) ? name : null
}

/** The stylesheet that serves a family, with the weights the interface uses. */
export const googleFontUrl = (name: string, weights = true): string =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}${
    weights ? ':wght@400;500;600;700' : ''
  }&display=swap`

/** Accepts a preset id, a `google:Name` id, or any raw family name the user typed. */
export function resolveFontStack(id: string): string {
  const preset = fontOptions.find((f) => f.id === id)
  if (preset) return preset.stack
  if (!id.trim()) return fontOptions[0].stack
  const name = googleFontName(id) ?? id
  const quoted = /[^\w-]/.test(name) ? `'${name.replace(/'/g, '')}'` : name
  return `${quoted}, ${fontOptions[0].stack}`
}
