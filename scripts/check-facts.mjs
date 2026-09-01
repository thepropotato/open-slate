/**
 * Checks that published copy still agrees with the code.
 *
 * The same numbers appear in the README, the site and the store listing, and a
 * new widget used to mean remembering every one of them. Each is read back out
 * of the code that implements it, then matched in its own prose context rather
 * than as a bare number, because these files are full of incidental digits —
 * CSS lengths, SVG path data, image dimensions.
 *
 *   node --import ./scripts/register.mjs scripts/check-facts.mjs
 *   ... --print     the facts themselves, as JSON
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

// Zod wraps enums in defaults and optionals; peel until the options surface.
const unwrap = (node, key) => {
  let current = node
  while (current && !current[key] && current.unwrap) current = current.unwrap()
  return current
}

export async function collectFacts() {
  const { searchEngines } = await import('@/features/search/engines.ts')
  const { themePresets } = await import('@/core/theme/presets.ts')
  const { Background } = await import('@/core/settings/schema.ts')

  const background = unwrap(Background, 'shape')
  const wallpaperKinds = unwrap(background.shape.type, 'options').options

  const brands = JSON.parse(read('src/generated/brands.json'))
  const pkg = JSON.parse(read('package.json'))

  // Each widget self-registers on import, so the import list is the roster.
  const widgetIndex = read('src/features/widgets/index.ts')
  const widgets = [...widgetIndex.matchAll(/^import '\.\/.+'$/gm)].length

  // The picker's own option list, which counts the three analog variants apart.
  const clock = read('src/features/widgets/clock/ClockWidget.tsx')
  const styles = clock.slice(clock.indexOf('const STYLES = ['), clock.indexOf('] as const'))
  const clockFaces = [...styles.matchAll(/^ {2}'[a-z-]+',$/gm)].length

  return {
    version: pkg.version,
    widgets,
    searchEngines: searchEngines.length,
    brandLogos: Object.keys(brands.icons).length,
    clockFaces,
    palettes: themePresets.length,
    wallpaperKinds: wallpaperKinds.length,
    trackers: 0,
  }
}

const facts = await collectFacts()

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty']

// Matches the number as a digit or, where one exists, its English word.
const numberPattern = (value) => {
  const word = WORDS[value]
  return word ? `(?:${value}|${word}|${word[0].toUpperCase()}${word.slice(1)})` : String(value)
}

/**
 * Each claim pairs the fact with the phrasing that must carry it. `near` is the
 * wording that identifies the sentence, and the count has to appear within
 * `window` characters either side of it — close enough that the incidental
 * digits elsewhere in the file cannot satisfy a claim by accident.
 */
const CLAIMS = [
  { file: 'README.md', fact: 'brandLogos', near: 'dataset \\(\\d+ sites\\)' },
  { file: 'README.md', fact: 'widgets', near: ' widgets: clock' },
  { file: 'marketing/LISTING.md', fact: 'brandLogos', near: 'Logos for \\d+ sites' },
  { file: 'marketing/site/index.html', fact: 'widgets', near: ' widgets including' },
  { file: 'marketing/site/index.html', fact: 'widgets', near: '</b> widgets<' },
  { file: 'marketing/site/index.html', fact: 'searchEngines', near: '</b> search engines<' },
  { file: 'marketing/site/index.html', fact: 'brandLogos', near: '</b> brand logos<' },
  { file: 'marketing/site/index.html', fact: 'clockFaces', near: '</b> clock faces<' },
  { file: 'marketing/site/index.html', fact: 'palettes', near: '</b> palettes<' },
  { file: 'marketing/site/index.html', fact: 'wallpaperKinds', near: '</b> wallpaper kinds<' },
  { file: 'marketing/site/index.html', fact: 'trackers', near: '</b> trackers<' },
  { file: 'marketing/site/index.html', fact: 'widgets', near: ' widgets, and none of them overlap' },
]

const WINDOW = 24

if (process.argv.includes('--print')) {
  console.log(JSON.stringify(facts, null, 2))
  process.exit(0)
}

const problems = []
const cache = new Map()

for (const { file, fact, near } of CLAIMS) {
  if (!cache.has(file)) cache.set(file, readFileSync(join(root, file), 'utf8'))
  const text = cache.get(file)

  const hits = [...text.matchAll(new RegExp(near, 'g'))]
  if (hits.length === 0) {
    problems.push(`${file}: nothing matches /${near}/ — the copy was reworded, so this claim needs updating`)
    continue
  }

  const expected = new RegExp(`\\b${numberPattern(facts[fact])}\\b`)
  for (const hit of hits) {
    const from = Math.max(0, hit.index - WINDOW)
    const context = text.slice(from, hit.index + hit[0].length + WINDOW)
    if (expected.test(context)) continue

    const line = text.slice(0, hit.index).split('\n').length
    const quoted = context.replace(/\s+/g, ' ').trim().slice(0, 70)
    problems.push(`${file}:${line}: expected ${fact} = ${facts[fact]} near "…${quoted}…"`)
  }
}

// The manifest ships to users, so a stale version there is the costly one.
const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8'))
if (manifest.version !== facts.version) {
  problems.push(`public/manifest.json: version ${manifest.version} does not match package.json ${facts.version}`)
}

if (problems.length) {
  console.error('Published copy contradicts the code:\n')
  for (const problem of problems) console.error(`  ${problem}`)
  console.error(`\n${problems.length} stale claim(s). Update the copy, or the claim in scripts/check-facts.mjs.`)
  process.exit(1)
}

console.log(`Facts check: ${CLAIMS.length} claims agree with the code.`)
