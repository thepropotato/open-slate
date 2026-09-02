// The search box's one piece of parsing: telling an address from a query.
// Everything else the box does is handed to the browser's default engine.

// Input that is already a destination: URL, bare host, or localhost.
export function asDestination(input: string): string | null {
  const value = input.trim()
  if (!value || /\s/.test(value)) return null
  if (/^(https?|ftp|file|chrome|about|edge):/i.test(value)) return value
  if (/^localhost(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`
  // A dotted label with a plausible TLD, e.g. example.com or sub.example.co.uk
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(value) && /\.[a-z]{2,}(?:[:/]|$)/i.test(value)) {
    return `https://${value}`
  }
  return null
}
