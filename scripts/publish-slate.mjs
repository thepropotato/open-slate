/**
 * Turns a slate submission issue into a gallery file, for the publish workflow.
 *
 *   node --import ./scripts/register.mjs scripts/publish-slate.mjs <title|write>
 *
 * Reads the issue from the Actions event payload rather than from anything
 * interpolated into the workflow, because the body is text a stranger wrote.
 * `title` prints the slate's name so the issue can be retitled after it; `write`
 * adds `slates/<id>.json`. `author` is the account that filed the issue, which is
 * the same unforgeable identity the pull request check compares against.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const mode = process.argv[2]
const { issue } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))

/** Issue forms render each field as `### Label` followed by its value. */
function field(label) {
  const sections = (issue.body ?? '').replace(/\r\n/g, '\n').split(/^### /m)
  const section = sections.find((s) => s.startsWith(`${label}\n`))
  if (!section) return ''
  const value = section
    .slice(label.length + 1)
    .trim()
    .replace(/^```\w*\n?|\n?```\s*$/g, '')
    .trim()
  return value === '_No response_' ? '' : value
}

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
}

const name = field('Slate name')

if (mode === 'title') {
  // Newlines would break the output file; the name is single-line anyway.
  output('name', name.replace(/[\r\n]+/g, ' ').slice(0, 40))
  process.exit(0)
}

if (mode !== 'write') {
  console.error('Usage: publish-slate.mjs <title|write>')
  process.exit(1)
}

const id = name
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40)
  .replace(/-+$/, '')

const credit = field('Name to credit (optional)')
const entry = {
  id,
  name,
  description: field('What it is for'),
  author: issue.user.login,
  ...(credit ? { credit } : {}),
  code: field('The slate code').replace(/\s+/g, ''),
  added: new Date().toISOString().slice(0, 10),
}

// Imported here so retitling, which runs on every submission, needs no `npm ci`.
const { validateEntry } = await import('@/core/settings/slateGallery')

const path = join('slates', `${id}.json`)
try {
  if (existsSync(path)) throw new Error(`a slate called ${id} is already in the gallery`)
  validateEntry(entry)
} catch (error) {
  console.error(error.message)
  output('error', error.message.replace(/[\r\n]+/g, ' '))
  process.exit(1)
}

writeFileSync(path, `${JSON.stringify(entry, null, 2)}\n`)
output('path', path)
output('id', id)
console.log(`Wrote ${path}`)
