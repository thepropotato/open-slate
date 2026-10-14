/**
 * Validates every submitted slate in `slates/`, and rebuilds the index the
 * gallery reads.
 *
 * This is the whole moderation mechanism on the machine side. A submission is a
 * pull request adding one JSON file; CI runs this, and a reviewer reads a name,
 * a description and a rendered preview rather than a wall of base64 they cannot
 * check by eye. Anything this script rejects never reaches the review queue.
 *
 * With `--issues` it also takes in the slates submitted as issues, which is what
 * the site build runs. The committed index is the files alone, so CI never
 * depends on the GitHub API.
 *
 *   node --import ./scripts/register.mjs scripts/check-slates.mjs [--write] [--issues]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { knownTypes } from './widget-types.mjs'

const { validateEntry } = await import('@/core/settings/slateGallery')

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

if (process.argv.includes('--issues')) {
  const { issueEntries } = await import('./issue-slates.mjs')
  const fromIssues = await issueEntries(seen.keys(), (type) => known.has(type))
  for (const { entry, payload, issue } of fromIssues.entries) {
    entries.push(entry)
    console.log(`  ${entry.id}: ${payload.widgets.length} widgets by @${entry.author} (#${issue})`)
  }
  for (const { issue, reason } of fromIssues.skipped) console.warn(`  #${issue} left out: ${reason}`)
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
