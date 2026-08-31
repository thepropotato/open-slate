/**
 * Locally-resolving stacks only: a webfont would need a looser CSP, and a new tab
 * has to paint instantly. A raw family name names any installed font.
 */

export interface FontOption {
  id: string
  label: string
  stack: string
}

export const fontOptions: FontOption[] = [
  { id: 'system', label: 'System', stack: `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` },
  { id: 'rounded', label: 'Rounded', stack: `ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Quicksand, system-ui, sans-serif` },
  { id: 'grotesk', label: 'Grotesk', stack: `Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif` },
  { id: 'serif', label: 'Serif', stack: `ui-serif, Georgia, 'Iowan Old Style', 'Times New Roman', serif` },
  { id: 'mono', label: 'Mono', stack: `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace` },
  { id: 'condensed', label: 'Condensed', stack: `'Avenir Next Condensed', 'Roboto Condensed', 'Arial Narrow', system-ui, sans-serif` },
]

/** Accepts a preset id, or any raw family name the user typed. */
export function resolveFontStack(id: string): string {
  const preset = fontOptions.find((f) => f.id === id)
  if (preset) return preset.stack
  if (!id.trim()) return fontOptions[0].stack
  const quoted = /[^\w-]/.test(id) ? `'${id.replace(/'/g, '')}'` : id
  return `${quoted}, ${fontOptions[0].stack}`
}
