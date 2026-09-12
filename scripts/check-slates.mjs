/**
 * Validates every submitted slate in `slates/`, and rebuilds the index the
 * gallery reads.
 *
 * This is the whole moderation mechanism on the machine side. A submission is a
 * pull request adding one JSON file; CI runs this, and a reviewer reads a name,
 * a description and a rendered preview rather than a wall of base64 they cannot
 * check by eye. Anything this script rejects never reaches the review queue.
 *
 *   node --import ./scripts/register.mjs scripts/check-slates.mjs [--write]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const { validateEntry } = await import('@/core/settings/slateGallery')

// Widget types are read out of the sources rather than by importing the
// registry: registering a widget imports its React component, and this runs
// under plain Node with no DOM. `check-facts.mjs` reads the same file the same way.
function knownTypes() {
  const index = readFileSync(join('src', 'features', 'widgets', 'index.ts'), 'utf8')
  const types = new Set()
  for (const [, path] of index.matchAll(/^import '\.\/(.+)'$/gm)) {
    const source = readFileSync(join('src', 'features', 'widgets', `${path}.tsx`), 'utf8')
    const match = /registerWidget(?:<[^>]*>)?\(\{[\s\S]*?type: '([a-z0-9-]+)'/.exec(source)
    if (match) types.add(match[1])
  }
  return types
}

const DIR = 'slates'
const INDEX = join('marketing', 'site', 'slates.json')

const known = knownTypes()
const write = process.argv.includes('--write')

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()

const problems = []
const entries = []
const seen = new Map()

for (const file of files) {
  const path = join(DIR, file)
  let raw
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    problems.push(`${path}: not valid JSON - ${error.message}`)
    continue
  }

  try {
    const { entry, payload } = validateEntry(raw, (type) => known.has(type))

    // The file name is the id, so a merged slate has one address and the index
    // cannot disagree with the folder.
    if (`${entry.id}.json` !== file) {
      problems.push(`${path}: should be named ${entry.id}.json`)
      continue
    }
    if (seen.has(entry.id)) {
      problems.push(`${path}: id already used by ${seen.get(entry.id)}`)
      continue
    }
    seen.set(entry.id, path)
    entries.push(entry)

    const cells = payload.widgets.length
    console.log(`  ${entry.id}: ${cells} widget${cells === 1 ? '' : 's'} by @${entry.author}`)
  } catch (error) {
    problems.push(`${path}: ${error.message}`)
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} slate${problems.length === 1 ? '' : 's'} could not be accepted:\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('')
  process.exit(1)
}

// Newest first, so the gallery leads with what was added last.
entries.sort((a, b) => b.added.localeCompare(a.added) || a.id.localeCompare(b.id))
const index = `${JSON.stringify({ version: 1, slates: entries }, null, 2)}\n`

if (write) {
  writeFileSync(INDEX, index)
  console.log(`\nWrote ${INDEX} with ${entries.length} slate${entries.length === 1 ? '' : 's'}.`)
} else {
  const current = (() => {
    try {
      return readFileSync(INDEX, 'utf8')
    } catch {
      return ''
    }
  })()
  if (current !== index) {
    console.error(`\n${INDEX} is out of date. Run \`npm run slates\` and commit the result.`)
    process.exit(1)
  }
  console.log(`\n${entries.length} slate${entries.length === 1 ? '' : 's'} valid, index up to date.`)
}
