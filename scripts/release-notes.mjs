/**
 * Reads one release out of CHANGELOG.md.
 *
 * The changelog is written once and read from three places - the GitHub
 * release body, the site's changelog page, and the store listing's "What's
 * new" box, which is plain text and has to be pasted by hand because the
 * Chrome Web Store API has no endpoint for listing copy.
 *
 *   node scripts/release-notes.mjs            the newest released version
 *   node scripts/release-notes.mjs 1.1.0      that version
 *   node scripts/release-notes.mjs --unreleased
 *   node scripts/release-notes.mjs --format=store
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Splits the changelog into `{ version, body }`, in file order. */
export function parseChangelog(text = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')) {
  const sections = []
  // A heading line, up to the next one or the link definitions at the foot.
  const heading = /^## \[([^\]]+)\]/gm

  for (const match of text.matchAll(heading)) {
    const start = match.index + match[0].length
    heading.lastIndex = start
    const next = heading.exec(text)
    heading.lastIndex = start

    const end = next ? next.index : text.search(/^\[Unreleased\]:/m)
    const body = text.slice(start, end === -1 ? undefined : end)
    sections.push({ version: match[1], body: body.replace(/^.*\n/, '').trim() })
  }

  return sections
}

export const findRelease = (wanted, sections = parseChangelog()) => {
  if (wanted === '--unreleased') return sections.find((s) => s.version === 'Unreleased')
  if (wanted) return sections.find((s) => s.version === wanted)
  return sections.find((s) => s.version !== 'Unreleased')
}

/**
 * The store's "What's new" box takes plain text, so headings become labels and
 * the markdown bullets lose their wrapping.
 */
export function toStoreText(body) {
  // The box renders no markup, so backticks, emphasis and links would show as typed.
  const plain = (line) =>
    line
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')

  return body
    .split('\n')
    .reduce((lines, line) => {
      const heading = line.match(/^### (.+)$/)
      if (heading) {
        lines.push('', `${heading[1].toUpperCase()}`)
        return lines
      }
      if (/^[-*] /.test(line)) lines.push(`• ${plain(line.slice(2).trim())}`)
      else if (line.trim() === '') lines.push('')
      // A wrapped bullet continues the line above it.
      else if (lines.length) lines[lines.length - 1] += ` ${plain(line.trim())}`
      return lines
    }, [])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The subset of markdown the changelog actually uses. */
const inline = (text) =>
  escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

function toHtmlSection({ version, body }) {
  const out = [`<h2>${escape(version)}</h2>`]
  let list = null

  for (const line of body.split('\n')) {
    const heading = line.match(/^### (.+)$/)
    const bullet = line.match(/^[-*] (.+)$/)

    if (heading) {
      if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null }
      out.push(`<h3>${escape(heading[1])}</h3>`)
    } else if (bullet) {
      list ??= []
      list.push(`<li>${inline(bullet[1])}</li>`)
    } else if (line.trim() === '') {
      // Blank lines separate blocks; a wrapped bullet has no blank before it.
    } else if (list) {
      list[list.length - 1] = list[list.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`)
    } else {
      out.push(`<p>${inline(line.trim())}</p>`)
    }
  }

  if (list) out.push(`<ul>${list.join('')}</ul>`)
  return out.join('\n    ')
}

/**
 * Renders the whole changelog as a page, borrowing the privacy page's own
 * stylesheet so the two cannot drift apart.
 */
function renderPage(sections) {
  const privacy = readFileSync(join(root, 'marketing/site/privacy.html'), 'utf8')
  const style = privacy.slice(privacy.indexOf('<style>'), privacy.indexOf('</style>') + 8)

  const released = sections.filter((s) => s.version !== 'Unreleased')
  const latest = released[0]?.version ?? ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open Slate: changelog</title>
<meta name="description" content="What changed in each release of the Open Slate Chrome extension.">
<link rel="canonical" href="https://openslate.byvenu.com/changelog">
<meta name="robots" content="index, follow">

<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

${style}
<style>
/* The version headings carry the weight here, so they are larger than the
   uppercase section labels the privacy page styles its headings as. */
main h2{
  font:400 clamp(1.5rem,4vw,1.875rem)/1.2 var(--serif);text-transform:none;
  letter-spacing:-.01em;color:var(--head);
  border-top:1px solid var(--border);padding-top:1.5rem;
  margin:clamp(2.25rem,6vw,3rem) 0 .25rem;
}
main h2:first-child{border-top:0;padding-top:0;margin-top:1rem}
main h3{
  font:600 .8125rem/1.3 var(--sans);text-transform:uppercase;letter-spacing:.08em;
  color:var(--muted);margin:1.375rem 0 .5rem;
}
code{
  font-size:.9em;background:var(--accent-soft);color:var(--head);
  padding:.1em .35em;border-radius:.3rem;
}
</style>
</head>
<body>

<div class="wrap">
  <header>
    <a class="back" href="/">&larr; Open Slate</a>
    <h1>Changelog</h1>
    <p class="lede">What changed in each release, newest first.</p>
    ${latest ? `<p class="updated">Latest release ${escape(latest)}</p>` : ''}
  </header>

  <main>
    ${sections.map(toHtmlSection).join('\n\n    ')}
  </main>

  <footer>
    <a href="/">Open Slate</a>
    <a href="https://github.com/thepropotato/open-slate">Source</a>
    <a href="/privacy">Privacy policy</a>
    <a href="https://github.com/thepropotato/open-slate/blob/main/LICENSE">MIT licence</a>
  </footer>
</div>

</body>
</html>
`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const format = args.find((a) => a.startsWith('--format='))?.slice(9) ?? 'markdown'
  const wanted = args.find((a) => !a.startsWith('--format='))

  if (format === 'page') {
    const out = join(root, 'marketing/site/changelog.html')
    const rendered = renderPage(parseChangelog())

    // The page is committed, so CI checks it rather than trusting a manual run.
    if (args.includes('--check')) {
      const current = readFileSync(out, 'utf8')
      if (current !== rendered) {
        console.error('marketing/site/changelog.html is out of date. Run `npm run site:changelog`.')
        process.exit(1)
      }
      console.log('Changelog page is up to date.')
    } else {
      writeFileSync(out, rendered)
      console.log(`Wrote ${out.slice(root.length + 1)}`)
    }
  } else {
    const release = findRelease(wanted)
    if (!release) {
      console.error(`No such release in CHANGELOG.md: ${wanted ?? '(latest)'}`)
      process.exit(1)
    }
    console.log(format === 'store' ? toStoreText(release.body) : release.body)
  }
}
