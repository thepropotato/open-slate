/**
 * Clean human-readable title extraction from hostnames and URLs.
 * Converts hosts like "linear.com" or "app.linear.com" to "Linear",
 * "my-cool-site.io" to "My Cool Site", etc.
 */

const MULTI_TLDS = new Set([
  'co.uk',
  'com.au',
  'co.nz',
  'co.jp',
  'com.br',
  'co.in',
  'org.uk',
  'gov.uk',
  'com.sg',
  'edu.au',
  'ac.uk',
])

const GENERIC_SUBDOMAINS = new Set([
  'www',
  'app',
  'web',
  'dash',
  'dashboard',
  'portal',
  'my',
  'm',
  'mobile',
  'admin',
  'console',
  'login',
  'auth',
  'api',
  'docs',
  'help',
  'support',
  'status',
])

const UPPERCASE_WORDS = new Set(['ai', 'api', 'ui', 'tv', 'id', 'os', 'sdk', 'cli', 'db', 'rss'])

/**
 * Extracts and formats a clean display title from a raw hostname.
 * e.g. "linear.com" -> "Linear"
 *      "app.linear.com" -> "Linear"
 *      "super-tool.io" -> "Super Tool"
 *      "my_awesome_site.dev" -> "My Awesome Site"
 */
export function formatHostTitle(host: string): string {
  if (!host) return ''

  let cleaned = host.toLowerCase().trim()
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.slice(4)
  }

  // Check multi-part TLDs first (e.g. .co.uk)
  let foundTld = false
  for (const tld of MULTI_TLDS) {
    if (cleaned.endsWith('.' + tld)) {
      cleaned = cleaned.slice(0, -(tld.length + 1))
      foundTld = true
      break
    }
  }

  // Otherwise strip standard single TLD
  if (!foundTld) {
    const lastDot = cleaned.lastIndexOf('.')
    if (lastDot > 0) {
      cleaned = cleaned.slice(0, lastDot)
    }
  }

  // Split into subdomain labels
  const parts = cleaned.split('.').filter(Boolean)
  if (parts.length === 0) return ''

  // If there are multiple parts (e.g. ['app', 'linear']), filter out generic prefixes
  let candidate = parts[parts.length - 1]
  if (parts.length > 1) {
    const nonGeneric = parts.filter((part) => !GENERIC_SUBDOMAINS.has(part))
    if (nonGeneric.length > 0) {
      candidate = nonGeneric[nonGeneric.length - 1]
    }
  }

  // Split on hyphens, underscores, or periods
  const words = candidate.split(/[-_.]+/).filter(Boolean)
  if (words.length === 0) return candidate

  return words
    .map((word) => {
      if (UPPERCASE_WORDS.has(word)) return word.toUpperCase()
      // Preserve existing internal capitalization like "1Password" or "iPhone" if any,
      // otherwise capitalize the first letter.
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

