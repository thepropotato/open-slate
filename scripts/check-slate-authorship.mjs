/**
 * Checks that a submitted slate is credited to whoever actually submitted it.
 *
 * `check-slates.mjs` proves a slate is well formed and can be applied. It cannot
 * prove who wrote it: `author` is a string in a JSON body, so a submission can
 * claim any name at all. The one identity nobody can fill in themselves is the
 * account that opened the pull request, which GitHub supplies to the workflow.
 * Comparing the two is the whole check.
 *
 *   SUBMITTER=<github login> node scripts/check-slate-authorship.mjs <dir>
 *
 * Credit for someone else's work is still possible, deliberately - a maintainer
 * tidying up or porting a layout should be able to leave the original author in
 * place. That is why a mismatch fails the check rather than rewriting the field:
 * it asks a human to look, and the reviewer can merge anyway.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? '.incoming'
const submitter = (process.env.SUBMITTER ?? '').trim()

if (!submitter) {
  console.error('SUBMITTER is not set; refusing to pass a check that proves nothing.')
  process.exit(1)
}

function slateFiles(dir) {
  let out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out = out.concat(slateFiles(path))
    else if (name.endsWith('.json')) out.push(path)
  }
  return out
}

const files = slateFiles(join(root, 'slates'))

if (files.length === 0) {
  console.log('No slate files in this pull request.')
  process.exit(0)
}

const mismatched = []

for (const path of files) {
  let entry
  try {
    entry = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    // Shape is `check-slates.mjs`'s job; this one only reads the credit.
    console.log(`  ${path}: unreadable here, left to the main check (${error.message})`)
    continue
  }

  const claimed = typeof entry.author === 'string' ? entry.author.trim() : ''
  if (claimed.toLowerCase() === submitter.toLowerCase()) {
    console.log(`  ${path}: credited to @${claimed}, who opened this pull request`)
  } else {
    mismatched.push({ path, claimed })
  }
}

if (mismatched.length === 0) {
  console.log(`\nEvery slate is credited to @${submitter}.`)
  process.exit(0)
}

console.error(`\nThis pull request was opened by @${submitter}, but:\n`)
for (const { path, claimed } of mismatched) {
  console.error(`  ${path} is credited to ${claimed ? `@${claimed}` : 'nobody'}`)
}
console.error(
  '\nSet `author` to the account opening the pull request. If you are submitting\n' +
    "someone else's layout on their behalf, say so in the description and a\n" +
    'maintainer can merge this with the credit left as it is.\n',
)
process.exit(1)
