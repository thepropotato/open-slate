/**
 * The fonts on offer. Each non-system face ships inside the extension (`fontFaces.css`), so a
 * new tab paints without waiting on a download and no looser CSP is needed.
 */

export interface FontOption {
  id: string
  label: string
  stack: string
}

const SYSTEM = `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`

export const fontOptions: FontOption[] = [
  { id: 'system', label: 'System default', stack: SYSTEM },
  { id: 'brand', label: 'Bricolage Grotesque (Open Slate)', stack: `'Bricolage Grotesque', ${SYSTEM}` },
  { id: 'inter', label: 'Inter (clean sans)', stack: `Inter, ${SYSTEM}` },
  { id: 'rounded', label: 'Nunito (rounded)', stack: `Nunito, ui-rounded, ${SYSTEM}` },
  { id: 'serif', label: 'Lora (serif)', stack: `Lora, ui-serif, Georgia, 'Times New Roman', serif` },
  { id: 'mono', label: 'JetBrains Mono (mono)', stack: `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace` },
  { id: 'hand', label: 'Caveat (handwritten)', stack: `Caveat, 'Segoe Print', 'Bradley Hand', cursive` },
]

/** Accepts a preset id, or any raw family name the user typed. */
export function resolveFontStack(id: string): string {
  const preset = fontOptions.find((f) => f.id === id)
  if (preset) return preset.stack
  if (!id.trim()) return fontOptions[0].stack
  const quoted = /[^\w-]/.test(id) ? `'${id.replace(/'/g, '')}'` : id
  return `${quoted}, ${fontOptions[0].stack}`
}
