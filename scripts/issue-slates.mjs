/**
 * Slates submitted as issues, which is how most of them arrive.
 *
 * Filing the submission form is what publishes a slate: the site build reads
 * every issue labelled `slate` and puts the valid ones in the gallery, so there
 * is no review queue and nothing is committed. Closing an issue as not planned,
 * or deleting it, takes the slate back out on the next build.
 *
 * The issue body is a stranger's text. It is read here as data and goes through
 * the same `validateEntry` as a file in `slates/`. `author` is the account that
 * filed the issue, which nobody can fill in on someone else's behalf.
 *
 *   node --import ./scripts/register.mjs scripts/issue-slates.mjs review
 *
 * `review` checks the issue in the Actions event payload, for the workflow that
 * answers each submission.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { knownTypes } from './widget-types.mjs'

const { validateEntry } = await import('@/core/settings/slateGallery')

const REPO = 'thepropotato/open-slate'
const LABEL = 'slate'
const ID_MAX = 40

/** Issue forms render each field as `### Label` followed by its value. */
function field(body, label) {
  const sections = (body ?? '').replace(/\r\n/g, '\n').split(/^### /m)
  const section = sections.find((s) => s.startsWith(`${label}\n`))
  if (!section) return ''
  const value = section
    .slice(label.length + 1)
    .trim()
    .replace(/^```\w*\n?|\n?```\s*$/g, '')
    .trim()
  return value === '_No response_' ? '' : value
}

function slug(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ID_MAX)
    .replace(/-+$/, '')
}

/** The gallery entry an issue describes, before validation. */
export function entryFromIssue(issue) {
  const name = field(issue.body, 'Slate name')
  const credit = field(issue.body, 'Name to credit (optional)')
  return {
    id: slug(name) || `slate-${issue.number}`,
    name,
    description: field(issue.body, 'What it is for'),
    author: issue.user.login,
    ...(credit ? { credit } : {}),
    code: field(issue.body, 'The slate code').replace(/\s+/g, ''),
    added: issue.created_at.slice(0, 10),
  }
}

/** Open, or closed as done. Closed as not planned is how a slate is taken down. */
function isListed(issue) {
  return !issue.pull_request && (issue.state === 'open' || issue.state_reason === 'completed')
}

async function fetchIssues() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'open-slate-gallery' }
  // Optional, but builds share addresses and the anonymous limit is per address.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  const issues = []
  for (let page = 1; ; page += 1) {
    const url = `https://api.github.com/repos/${REPO}/issues?labels=${LABEL}&state=all&per_page=100&page=${page}`
    const response = await fetch(url, { headers })
    // Thrown rather than skipped: a gallery built from half the issues would
    // silently unpublish the rest, and a failed build keeps the last good one live.
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${url}`)
    const batch = await response.json()
    issues.push(...batch)
    if (batch.length < 100) return issues
  }
}

/**
 * Every listed slate issue that validates, with ids that do not collide with
 * `taken`. An invalid submission is reported and left out rather than failing
 * the build, because whoever filed it is not the one deploying.
 */
export async function issueEntries(taken, isKnownType) {
  const issues = (await fetchIssues()).filter(isListed).sort((a, b) => a.number - b.number)
  const ids = new Set(taken)
  const entries = []
  const skipped = []

  for (const issue of issues) {
    const raw = entryFromIssue(issue)
    // The earliest issue keeps the plain name; a later one with the same name
    // is told apart by its number, so neither link changes when the other goes.
    if (ids.has(raw.id)) raw.id = `${raw.id.slice(0, ID_MAX - 8)}-${issue.number}`
    try {
      const { entry, payload } = validateEntry(raw, isKnownType)
      ids.add(entry.id)
      entries.push({ entry, payload, issue: issue.number })
    } catch (error) {
      skipped.push({ issue: issue.number, reason: error.message })
    }
  }
  return { entries, skipped }
}

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${String(value).replace(/[\r\n]+/g, ' ')}\n`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'review') {
    console.error('Usage: issue-slates.mjs review')
    process.exit(1)
  }
  const { issue } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const raw = entryFromIssue(issue)
  output('name', raw.name.slice(0, ID_MAX))
  try {
    const known = knownTypes()
    validateEntry(raw, (type) => known.has(type))
    output('ok', 'true')
    console.log(`#${issue.number} is a valid slate: ${raw.name}`)
  } catch (error) {
    output('ok', 'false')
    output('error', error.message)
    console.log(`#${issue.number} cannot be listed: ${error.message}`)
  }
}
